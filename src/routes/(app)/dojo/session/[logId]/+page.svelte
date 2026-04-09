<script lang="ts">
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"

  let log = $state(page.data.log)
  let exercises = $state(page.data.exercises ?? [])
  $effect(() => {
    log = page.data.log
    exercises = page.data.exercises ?? []
  })

  // Sets state — mirrors the log's sets array, editable locally
  let sets = $state<any[]>(log?.sets ?? [])
  let setsInitialized = false
  $effect(() => {
    if (!setsInitialized) {
      sets = log?.sets ?? []
      setsInitialized = true
    }
  })

  let notes = $state(log?.notes ?? "")
  let caloriesBurned = $state<number | null>(log?.caloriesBurned ?? null)
  let cardioDistance = $state<number | null>(log?.cardioDistance ?? null)
  let saving = false
  let completing = $state(false)
  let recalculating = $state(false)

  // Editable dates for completed sessions
  let editingDates = $state(false)
  let editStartedAt = $state("")
  let editCompletedAt = $state("")
  let savingDates = $state(false)

  function toLocalDatetime(iso: string): string {
    if (!iso) return ""
    const d = new Date(iso)
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }

  function openDateEditor() {
    editStartedAt = toLocalDatetime(log.startedAt)
    editCompletedAt = toLocalDatetime(log.completedAt)
    caloriesBurned = log.caloriesBurned ?? null
    if (isCardio) {
      cardioDistance = log.cardioDistance ?? null
    }
    editingDates = true
  }

  async function saveDates() {
    savingDates = true
    try {
      const body: Record<string, any> = {
        startedAt: new Date(editStartedAt).toISOString(),
        completedAt: new Date(editCompletedAt).toISOString(),
        caloriesBurned: caloriesBurned ?? null,
      }
      if (isCardio) {
        body.cardioDistance = cardioDistance ?? null
      }
      const res = await fetch(`/api/dojo/logs/${log.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        log = updated
        editingDates = false
      }
    } catch (err) {
      console.error("Failed to save details:", err)
    }
    savingDates = false
  }

  // Auto-save sets whenever they change
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  $effect(() => {
    // Read sets to establish reactive dependency
    void sets
    if (!setsInitialized || isCompleted || !log) return
    // Debounce saves to avoid hammering the API
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveSets()
    }, 500)
  })

  // RPE prompt state
  let rpePromptExerciseId = $state<string | null>(null)
  let rpeValue = $state<number | null>(null)

  // Rest timer state
  let restTimerActive = $state(false)
  let restSecondsLeft = $state(0)
  let restTimerInterval = $state<ReturnType<typeof setInterval> | null>(null)

  // Add exercise from library
  let addExerciseOpen = $state(false)
  let addExerciseId = $state("")

  const snapshotExercises = $derived(log?.planSnapshot?.exercises ?? [])
  const isCompleted = $derived(log?.status === "completed")
  const isCardio = $derived((log?.planSnapshot?.sessionType ?? "strength") === "cardio")

  // Initialize date fields for active cardio sessions
  $effect(() => {
    if (isCardio && !isCompleted && log) {
      editStartedAt = toLocalDatetime(log.startedAt)
      editCompletedAt = log.completedAt ? toLocalDatetime(log.completedAt) : toLocalDatetime(new Date().toISOString())
    }
  })


  function setsForExercise(exerciseId: string) {
    return sets.filter(s => s.exerciseId === exerciseId)
  }

  function getTargetForExercise(exerciseId: string) {
    return snapshotExercises.find((e: any) => e.exerciseId === exerciseId)
  }

  // All unique exerciseIds in order (snapshot + additional)
  const exerciseOrder = $derived(() => {
    const ordered: string[] = snapshotExercises.map((e: any) => e.exerciseId)
    for (const s of sets) {
      if (s.isAdditional && !ordered.includes(s.exerciseId)) {
        ordered.push(s.exerciseId)
      }
    }
    return ordered
  })

  function exerciseName(exerciseId: string): string {
    const snap = snapshotExercises.find((e: any) => e.exerciseId === exerciseId)
    if (snap) return snap.exerciseName
    return exercises.find((e: any) => e.id === exerciseId)?.name ?? "Unknown"
  }

  function exerciseMeta(exerciseId: string) {
    const snap = snapshotExercises.find((e: any) => e.exerciseId === exerciseId)
    if (snap) return snap
    const ex = exercises.find((e: any) => e.id === exerciseId)
    return ex ? { muscleGroup: ex.muscleGroup, equipment: ex.equipment, restSeconds: 90 } : null
  }

  function addSet(exerciseId: string, isAdditional = false) {
    const existing = setsForExercise(exerciseId)
    const target = getTargetForExercise(exerciseId)
    const lastSet = existing[existing.length - 1]

    sets = [...sets, {
      exerciseId,
      setNumber: existing.length + 1,
      weight: lastSet?.weight ?? target?.targetWeight ?? 0,
      reps: lastSet?.reps ?? target?.targetReps ?? 10,
      rpe: null,
      isAdditional,
    }]
  }

  function updateSet(exerciseId: string, setNumber: number, field: string, value: any) {
    sets = sets.map(s => {
      if (s.exerciseId !== exerciseId) return s
      if (s.setNumber === setNumber) return { ...s, [field]: value }
      // Propagate weight/reps changes to all sets below
      if ((field === "weight" || field === "reps") && s.setNumber > setNumber) {
        return { ...s, [field]: value }
      }
      return s
    })
  }

  function removeSet(exerciseId: string, setNumber: number) {
    sets = sets
      .filter(s => !(s.exerciseId === exerciseId && s.setNumber === setNumber))
      .map(s => {
        if (s.exerciseId === exerciseId && s.setNumber > setNumber) {
          return { ...s, setNumber: s.setNumber - 1 }
        }
        return s
      })
  }

  // Toggle set completed state and trigger RPE/rest timer
  function completeSet(exerciseId: string, setNumber: number) {
    const s = sets.find(s => s.exerciseId === exerciseId && s.setNumber === setNumber)
    if (!s) return

    // If already completed, toggle it off
    if (s.completed) {
      updateSet(exerciseId, setNumber, "completed", false)
      return
    }

    // Mark as completed
    updateSet(exerciseId, setNumber, "completed", true)

    const exSets = setsForExercise(exerciseId)
    const target = getTargetForExercise(exerciseId)
    const targetSetCount = target?.targetSets ?? exSets.length
    const isFinalSet = setNumber >= targetSetCount && setNumber >= exSets.length

    if (isFinalSet) {
      // Show RPE prompt
      rpePromptExerciseId = exerciseId
      rpeValue = null
    } else {
      // Start rest timer
      startRestTimer(exerciseId)
    }
  }

  function removeExercise(exerciseId: string) {
    sets = sets.filter(s => s.exerciseId !== exerciseId)
  }

  function submitRpe() {
    if (rpePromptExerciseId && rpeValue !== null) {
      // Find the last set of this exercise and set RPE
      const exSets = setsForExercise(rpePromptExerciseId)
      const lastSet = exSets[exSets.length - 1]
      if (lastSet) {
        updateSet(rpePromptExerciseId, lastSet.setNumber, "rpe", rpeValue)
      }
    }
    rpePromptExerciseId = null
    rpeValue = null
  }

  function skipRpe() {
    rpePromptExerciseId = null
    rpeValue = null
  }

  function startRestTimer(exerciseId: string) {
    const meta = exerciseMeta(exerciseId)
    const restSeconds = meta?.restSeconds ?? 90
    restSecondsLeft = restSeconds
    restTimerActive = true

    if (restTimerInterval) clearInterval(restTimerInterval)
    restTimerInterval = setInterval(() => {
      restSecondsLeft--
      if (restSecondsLeft <= 0) {
        dismissRestTimer()
      }
    }, 1000)
  }

  function dismissRestTimer() {
    restTimerActive = false
    if (restTimerInterval) {
      clearInterval(restTimerInterval)
      restTimerInterval = null
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  async function saveSets() {
    if (isCompleted) return
    saving = true
    try {
      const res = await fetch(`/api/dojo/logs/${log.id}/sets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sets }),
      })
      if (!res.ok) {
        console.error("Failed to save sets:", res.status, await res.text())
      }
    } catch (err) {
      console.error("Failed to save sets:", err)
    }
    saving = false
  }

  async function handleBackToDojo() {
    if (saveTimeout) clearTimeout(saveTimeout)
    await saveSets()
    goto("/dojo")
  }

  async function handleComplete() {
    completing = true
    if (saveTimeout) clearTimeout(saveTimeout)
    if (!isCardio) await saveSets()
    const completeBody: Record<string, any> = {
      notes: notes || null,
      caloriesBurned: caloriesBurned ?? null,
    }
    if (isCardio) {
      completeBody.cardioDistance = cardioDistance ?? null
      if (editStartedAt) completeBody.startedAt = new Date(editStartedAt).toISOString()
      if (editCompletedAt) completeBody.completedAt = new Date(editCompletedAt).toISOString()
    }
    const res = await fetch(`/api/dojo/logs/${log.id}/complete`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completeBody),
    })

    if (res.ok) {
      goto("/dojo")
    }
    completing = false
  }

  function openAddExercise() {
    addExerciseOpen = true
    addExerciseId = exercises[0]?.id ?? ""
  }

  function confirmAddExercise() {
    if (!addExerciseId) return
    addSet(addExerciseId, true)
    addExerciseOpen = false
  }

  async function handleRecalculate() {
    recalculating = true
    try {
      const res = await fetch(`/api/dojo/logs/${log.id}/recalculate`, { method: "POST" })
      if (res.ok) {
        log = await res.json()
      }
    } catch (err) {
      console.error("Failed to recalculate:", err)
    }
    recalculating = false
  }

  function exercisePerf(exerciseId: string) {
    return (log?.performance?.exercisePerformance ?? []).find(
      (ep: any) => ep.exerciseId === exerciseId,
    )
  }

  function formatVolume(v: number): string {
    return v.toLocaleString() + " lbs"
  }

  function muscleLabel(muscle: string): string {
    return muscle?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? ""
  }

  function equipmentLabel(eq: string): string {
    return eq?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? ""
  }
</script>

{#if !log}
  <PageHeader icon={icons.dojo} title="Session Not Found" subtitle="" />
  <div class="empty-state">
    <p>This workout session doesn't exist.</p>
    <Button variant="primary" href="/dojo">Back to Dojo</Button>
  </div>
{:else}
  <PageHeader
    icon={icons.dojo}
    title={log.planSnapshot?.sessionName ?? "Workout"}
    subtitle={log.planSnapshot?.planName ?? ""}
  />

  {#if isCompleted}
    <div class="completed-banner">Session completed</div>

    {#if log.performance}
      <div class="perf-card-wrap">
      <Card>
        <div class="perf-summary">
          <div class="perf-stats">
            {#if log.performance.totalVolume > 0}
              <div class="perf-stat">
                <span class="perf-stat-value">{formatVolume(log.performance.totalVolume)}</span>
                <span class="perf-stat-label">Total Volume</span>
              </div>
            {/if}
            <div class="perf-stat">
              <span class="perf-stat-value">{log.performance.totalReps.toLocaleString()}</span>
              <span class="perf-stat-label">Total Reps</span>
            </div>
            {#if log.caloriesBurned}
              <div class="perf-stat">
                <span class="perf-stat-value">{log.caloriesBurned}</span>
                <span class="perf-stat-label">Calories Burned</span>
              </div>
            {/if}
          </div>
          {#if log.performance.exercisePerformance.some((ep: any) => (ep.personalBests ?? []).length > 0)}
            <div class="perf-prs">
              <span class="perf-pr-title">Personal Records</span>
              {#each log.performance.exercisePerformance.filter((ep: any) => (ep.personalBests ?? []).length > 0) as ep}
                <div class="perf-pr-row">
                  <span class="perf-pr-name">{ep.exerciseName}</span>
                  <div class="perf-pr-tags">
                    {#each ep.personalBests as pb}
                      <span class="perf-pr-tag">
                        {pb === "best_set_volume" ? "Best Volume" : pb === "best_e1rm" ? "Best 1RM" : pb === "most_reps" ? "Most Reps" : pb === "heaviest_weight" ? "Heaviest Weight" : pb}
                      </span>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          <div class="perf-actions">
            <button class="recalc-btn" onclick={handleRecalculate} disabled={recalculating}>
              {recalculating ? "Recalculating..." : "Recalculate"}
            </button>
          </div>
        </div>
      </Card>
      </div>
    {/if}

    {#if editingDates}
      <div class="date-editor-wrapper">
        <Card>
          <div class="date-editor">
            <div class="form-row">
              <div class="form-field">
                <label class="field-label" for="edit-started-at">Started At</label>
                <input id="edit-started-at" type="datetime-local" class="field-input" bind:value={editStartedAt} />
              </div>
              <div class="form-field">
                <label class="field-label" for="edit-completed-at">Completed At</label>
                <input id="edit-completed-at" type="datetime-local" class="field-input" bind:value={editCompletedAt} />
              </div>
            </div>
            {#if isCardio}
              <div class="form-field">
                <label class="field-label" for="edit-cardio-distance">Distance (miles)</label>
                <input id="edit-cardio-distance" type="number" class="field-input" bind:value={cardioDistance} placeholder="Optional" min="0" step="0.01" />
              </div>
            {/if}
            <div class="form-field">
              <label class="field-label" for="edit-calories">Calories Burned</label>
              <input id="edit-calories" type="number" class="field-input" bind:value={caloriesBurned} placeholder="Optional" min="0" />
            </div>
            <div class="form-actions">
              <Button variant="secondary" onclick={() => (editingDates = false)}>Cancel</Button>
              <Button variant="primary" onclick={saveDates} disabled={savingDates}>
                {savingDates ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    {/if}
  {/if}

  <!-- Rest Timer Overlay -->
  {#if restTimerActive}
    <div class="rest-timer-overlay">
      <div class="rest-timer-card">
        <span class="rest-label">Rest</span>
        <span class="rest-time">{formatTime(restSecondsLeft)}</span>
        <Button variant="secondary" onclick={dismissRestTimer}>Skip</Button>
      </div>
    </div>
  {/if}

  <!-- RPE Prompt -->
  {#if rpePromptExerciseId}
    <div class="rpe-overlay">
      <div class="rpe-card">
        <h3 class="rpe-title">Rate of Perceived Exertion</h3>
        <p class="rpe-subtitle">{exerciseName(rpePromptExerciseId)}</p>
        <div class="rpe-scale">
          {#each Array.from({ length: 10 }, (_, i) => i + 1) as n}
            <button
              class="rpe-btn"
              class:selected={rpeValue === n}
              onclick={() => (rpeValue = n)}
            >
              {n}
            </button>
          {/each}
        </div>
        <div class="rpe-actions">
          <Button variant="secondary" onclick={skipRpe}>Skip</Button>
          <Button variant="primary" onclick={submitRpe} disabled={rpeValue === null}>Save RPE</Button>
        </div>
      </div>
    </div>
  {/if}

  {#if !isCardio}
  <!-- Exercise List -->
  <div class="exercise-list">
  {#each exerciseOrder() as exerciseId, exIdx}
    {@const target = getTargetForExercise(exerciseId)}
    {@const exSets = setsForExercise(exerciseId)}
    {@const meta = exerciseMeta(exerciseId)}
    {@const perf = exercisePerf(exerciseId)}
    <Card>
      <div class="exercise-block">
        <div class="exercise-header">
          <div class="exercise-title">
            <div class="exercise-name-row">
              <h3 class="exercise-name">{exerciseName(exerciseId)}</h3>
              {#if isCompleted && perf && (perf.personalBests ?? []).length > 0}
                <span class="pr-badge">PR</span>
              {/if}
            </div>
            {#if meta}
              <div class="exercise-badges">
                <span class="badge">{muscleLabel(meta.muscleGroup?.muscle)}</span>
                <span class="badge eq">{equipmentLabel(meta.equipment)}</span>
              </div>
            {/if}
            {#if isCompleted && perf}
              <div class="exercise-perf-row">
                {#if !perf.isBodyweight && perf.totalVolume > 0}
                  <span class="exercise-perf-item">{formatVolume(perf.totalVolume)}</span>
                {/if}
                {#if perf.e1RM}
                  <span class="exercise-perf-item">Est. 1RM: {perf.e1RM} lbs</span>
                {/if}
                <span class="exercise-perf-item">{perf.totalReps} reps</span>
              </div>
            {/if}
          </div>
          <div class="exercise-header-actions">
            {#if target}
              <span class="target-info">{target.targetSets}x{target.targetReps}{target.targetWeight ? ` @ ${target.targetWeight}lbs` : ""}</span>
            {/if}
            {#if !isCompleted}
              <button class="remove-exercise-btn" title="Remove exercise" onclick={() => removeExercise(exerciseId)}>&#x2715;</button>
            {/if}
          </div>
        </div>

        <!-- Sets Table -->
        <div class="sets-table">
          <div class="sets-header-row">
            <span class="col-set">Set</span>
            <span class="col-weight">Weight (lbs)</span>
            <span class="col-reps">Reps</span>
            <span class="col-rpe">RPE</span>
            <span class="col-actions"></span>
          </div>

          {#each exSets as s, sIdx}
            <div class="set-row" class:additional={s.isAdditional} class:completed={s.completed}>
              <span class="col-set">{s.setNumber}</span>
              <span class="col-weight">
                {#if isCompleted}
                  {s.weight}
                {:else}
                  <input
                    type="number"
                    class="set-input"
                    value={s.weight}
                    onchange={e => updateSet(exerciseId, s.setNumber, "weight", parseFloat(e.currentTarget.value) || 0)}
                  />
                {/if}
              </span>
              <span class="col-reps">
                {#if isCompleted}
                  {s.reps}
                {:else}
                  <input
                    type="number"
                    class="set-input"
                    value={s.reps}
                    onchange={e => updateSet(exerciseId, s.setNumber, "reps", parseInt(e.currentTarget.value) || 0)}
                  />
                {/if}
              </span>
              <span class="col-rpe">
                {s.rpe ?? "—"}
              </span>
              <span class="col-actions">
                {#if !isCompleted}
                  <button
                    class="check-btn"
                    class:checked={s.completed}
                    title={s.completed ? "Mark incomplete" : "Complete set"}
                    onclick={() => completeSet(exerciseId, s.setNumber)}
                  >&#x2713;</button>
                  <button
                    class="remove-btn"
                    title="Remove set"
                    onclick={() => removeSet(exerciseId, s.setNumber)}
                  >&#x2715;</button>
                {/if}
              </span>
            </div>
          {/each}
        </div>

        {#if !isCompleted}
          <button class="add-set-btn" onclick={() => addSet(exerciseId, !target)}>+ Add Set</button>
        {/if}
      </div>
    </Card>
  {/each}
  </div>

  <!-- Add Exercise from Library -->
  {#if !isCompleted}
    {#if addExerciseOpen}
      <Card>
        <div class="add-exercise-form">
          <span class="field-label">Add Exercise from Library</span>
          <select class="field-input" bind:value={addExerciseId}>
            {#each exercises as ex}
              <option value={ex.id}>{ex.name}</option>
            {/each}
          </select>
          <div class="form-actions">
            <Button variant="secondary" onclick={() => (addExerciseOpen = false)}>Cancel</Button>
            <Button variant="primary" onclick={confirmAddExercise}>Add</Button>
          </div>
        </div>
      </Card>
    {:else}
      <button class="add-exercise-btn" onclick={openAddExercise}>+ Add Exercise</button>
    {/if}
  {/if}
  {/if}

  <!-- Cardio Distance & Dates -->
  {#if isCardio}
    <div class="cardio-distance-wrap">
    {#if !isCompleted}
      <Card>
        <div class="form-row">
          <div class="form-field">
            <label class="field-label" for="cardio-started-at">Started At</label>
            <input id="cardio-started-at" type="datetime-local" class="field-input" bind:value={editStartedAt} />
          </div>
          <div class="form-field">
            <label class="field-label" for="cardio-completed-at">Completed At</label>
            <input id="cardio-completed-at" type="datetime-local" class="field-input" bind:value={editCompletedAt} />
          </div>
        </div>
        <div class="form-field">
          <label class="field-label" for="cardio-distance">Distance (miles)</label>
          <input id="cardio-distance" type="number" class="field-input" bind:value={cardioDistance} placeholder="Optional" min="0" step="0.01" />
        </div>
      </Card>
    {:else if log.cardioDistance}
      <Card>
        <div class="form-field">
          <span class="field-label">Distance</span>
          <p class="notes-display">{log.cardioDistance} mi</p>
        </div>
      </Card>
    {/if}
    </div>
  {/if}

  <!-- Notes & Complete -->
  {#if !isCompleted}
    <Card>
      <div class="session-footer">
        <div class="form-field">
          <label class="field-label" for="calories-burned">Calories Burned</label>
          <input id="calories-burned" type="number" class="field-input" bind:value={caloriesBurned} placeholder="Optional" min="0" />
        </div>
        <div class="form-field">
          <label class="field-label">Session Notes</label>
          <textarea class="notes-input" bind:value={notes} placeholder="How did it go?" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <Button variant="primary" onclick={handleComplete} disabled={completing}>
            {completing ? "Completing..." : "Complete Session"}
          </Button>
        </div>
      </div>
    </Card>
  {:else}
    {#if log.caloriesBurned || log.notes}
    <Card>
      <div class="session-footer">
        {#if log.caloriesBurned}
          <div class="form-field">
            <span class="field-label">Calories Burned</span>
            <p class="notes-display">{log.caloriesBurned} cal</p>
          </div>
        {/if}
        {#if log.notes}
          <div class="form-field">
            <span class="field-label">Notes</span>
            <p class="notes-display">{log.notes}</p>
          </div>
        {/if}
      </div>
    </Card>
    {/if}
  {/if}

  <div class="back-link">
    {#if isCompleted && !editingDates}
      <Button variant="secondary" onclick={openDateEditor}>Edit</Button>
    {/if}
    <Button variant="ghost" onclick={handleBackToDojo}>Close</Button>
  </div>
{/if}

<style>
  .exercise-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .completed-banner {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    text-align: center;
    padding: var(--space-2) var(--space-4);
    background: var(--accent-green);
    color: white;
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-4);
  }

  .perf-card-wrap,
  .cardio-distance-wrap {
    margin-bottom: var(--space-4);
  }

  .perf-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .perf-stats {
    display: flex;
    gap: var(--space-6);
    flex-wrap: wrap;
  }

  .perf-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .perf-stat-value {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--ink);
  }

  .perf-stat-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .perf-actions {
    display: flex;
    justify-content: flex-end;
  }

  .recalc-btn {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-3);
    background: none;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .recalc-btn:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .recalc-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .perf-prs {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 0.5px solid var(--border);
  }

  .perf-pr-title {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .perf-pr-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .perf-pr-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
  }

  .perf-pr-tags {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .perf-pr-tag {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    background: var(--accent-green);
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .exercise-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .pr-badge {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    background: var(--accent-green);
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .exercise-perf-row {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .exercise-perf-item {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
  }

  .exercise-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .exercise-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .exercise-title {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .exercise-name {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .exercise-badges {
    display: flex;
    gap: var(--space-2);
  }

  .badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--paper-warm);
    color: var(--ink-light);
  }

  .badge.eq {
    background: var(--paper);
    border: 0.5px solid var(--border);
  }

  .target-info {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    white-space: nowrap;
  }

  .exercise-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .remove-exercise-btn {
    font-size: var(--text-xs);
    padding: 2px 6px;
    background: none;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--ink-faint);
    transition: all var(--transition-fast);
  }

  .remove-exercise-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  /* Sets table */
  .sets-table {
    display: flex;
    flex-direction: column;
  }

  .sets-header-row {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-bottom: 0.5px solid var(--border);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .set-row {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    align-items: center;
    border-bottom: 0.5px solid var(--border);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .set-row.additional {
    background: var(--paper-warm);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
  }

  .set-row.completed {
    border-left: 3px solid var(--accent-green);
    padding-left: var(--space-2);
  }

  .col-set { width: 40px; text-align: center; }
  .col-weight { flex: 1; }
  .col-reps { flex: 1; }
  .col-rpe { width: 40px; text-align: center; }
  .col-actions { width: 60px; display: flex; gap: 4px; justify-content: flex-end; }

  .set-input {
    width: 100%;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-1) 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .set-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .check-btn, .remove-btn {
    font-size: var(--text-xs);
    padding: 2px 6px;
    background: none;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--ink-faint);
    transition: all var(--transition-fast);
  }

  .check-btn:hover {
    color: var(--accent-green);
    border-color: var(--accent-green);
  }

  .check-btn.checked {
    color: white;
    background: var(--accent-green);
    border-color: var(--accent-green);
  }

  .remove-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .add-set-btn {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2);
    background: none;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 100%;
  }

  .add-set-btn:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  /* Add Exercise */
  .add-exercise-btn {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-3);
    background: none;
    border: 1px dashed var(--border);
    border-radius: var(--radius-md);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 100%;
    text-align: center;
    margin-top: var(--space-2);
  }

  .add-exercise-btn:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .add-exercise-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Form shared */
  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2) 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    outline: none;
  }

  .form-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  /* Notes */
  .session-footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .notes-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--ink);
    outline: none;
    resize: vertical;
    transition: border-color var(--transition-fast);
  }

  .notes-input:focus {
    border-color: var(--border-strong);
  }

  .notes-display {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .back-link {
    margin-top: var(--space-4);
    text-align: center;
  }

  /* Rest Timer Overlay */
  .rest-timer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .rest-timer-card {
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  }

  .rest-label {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .rest-time {
    font-family: var(--font-display);
    font-size: 3rem;
    font-weight: 500;
    color: var(--ink);
  }

  /* RPE Overlay */
  .rpe-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .rpe-card {
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    max-width: 360px;
    width: 90%;
  }

  .rpe-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .rpe-subtitle {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .rpe-scale {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
    justify-content: center;
  }

  .rpe-btn {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    font-size: var(--text-base);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .rpe-btn:hover {
    border-color: var(--border-strong);
    background: var(--paper-warm);
  }

  .rpe-btn.selected {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .rpe-actions {
    display: flex;
    gap: var(--space-2);
  }

  .date-editor-wrapper {
    margin-bottom: var(--space-4);
  }

  .date-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }

  .form-row {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
</style>
