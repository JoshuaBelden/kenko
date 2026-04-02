<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"

  let log = $state(page.data.log)
  let exercises = $state(page.data.exercises ?? [])
  $effect(() => {
    log = page.data.log
    exercises = page.data.exercises ?? []
  })

  // Sets state — mirrors the log's sets array, editable locally
  let sets = $state<any[]>(log?.sets ?? [])
  $effect(() => {
    sets = log?.sets ?? []
  })

  let notes = $state(log?.notes ?? "")
  let saving = $state(false)
  let completing = $state(false)

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
      if (s.exerciseId === exerciseId && s.setNumber === setNumber) {
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

  // RPE: show prompt for the final set of an exercise
  function completeSet(exerciseId: string, setNumber: number) {
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
    saveSets()
  }

  function skipRpe() {
    rpePromptExerciseId = null
    rpeValue = null
    saveSets()
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

    saveSets()
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
    await fetch(`/api/dojo/logs/${log.id}/sets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sets }),
    })
    saving = false
  }

  async function handleComplete() {
    completing = true
    await saveSets()
    const res = await fetch(`/api/dojo/logs/${log.id}/complete`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || null }),
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
    saveSets()
  }

  function muscleLabel(muscle: string): string {
    return muscle?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? ""
  }

  function equipmentLabel(eq: string): string {
    return eq?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? ""
  }
</script>

{#if !log}
  <PageHeader kanji="道場" title="Session Not Found" subtitle="" />
  <div class="empty-state">
    <p>This workout session doesn't exist.</p>
    <Button variant="primary" href="/dojo">Back to Dojo</Button>
  </div>
{:else}
  <PageHeader
    kanji="道場"
    title={log.planSnapshot?.sessionName ?? "Workout"}
    subtitle={log.planSnapshot?.planName ?? ""}
  />

  {#if isCompleted}
    <div class="completed-banner">Session completed</div>
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

  <!-- Exercise List -->
  {#each exerciseOrder() as exerciseId, exIdx}
    {@const target = getTargetForExercise(exerciseId)}
    {@const exSets = setsForExercise(exerciseId)}
    {@const meta = exerciseMeta(exerciseId)}
    <Card>
      <div class="exercise-block">
        <div class="exercise-header">
          <div class="exercise-title">
            <h3 class="exercise-name">{exerciseName(exerciseId)}</h3>
            {#if meta}
              <div class="exercise-badges">
                <span class="badge">{muscleLabel(meta.muscleGroup?.muscle)}</span>
                <span class="badge eq">{equipmentLabel(meta.equipment)}</span>
              </div>
            {/if}
          </div>
          {#if target}
            <span class="target-info">{target.targetSets}x{target.targetReps}{target.targetWeight ? ` @ ${target.targetWeight}lbs` : ""}</span>
          {/if}
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
            <div class="set-row" class:additional={s.isAdditional}>
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
                    onblur={() => saveSets()}
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
                    onblur={() => saveSets()}
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
                    title="Complete set"
                    onclick={() => completeSet(exerciseId, s.setNumber)}
                  >&#x2713;</button>
                  <button
                    class="remove-btn"
                    title="Remove set"
                    onclick={() => { removeSet(exerciseId, s.setNumber); saveSets() }}
                  >&#x2715;</button>
                {/if}
              </span>
            </div>
          {/each}
        </div>

        {#if !isCompleted}
          <button class="add-set-btn" onclick={() => { addSet(exerciseId, !target); saveSets() }}>+ Add Set</button>
        {/if}
      </div>
    </Card>
  {/each}

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

  <!-- Notes & Complete -->
  {#if !isCompleted}
    <Card>
      <div class="session-footer">
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
  {:else if log.notes}
    <Card>
      <div class="form-field">
        <span class="field-label">Notes</span>
        <p class="notes-display">{log.notes}</p>
      </div>
    </Card>
  {/if}

  <div class="back-link">
    <Button variant="ghost" href="/dojo">Back to Dojo</Button>
  </div>
{/if}

<style>
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
</style>
