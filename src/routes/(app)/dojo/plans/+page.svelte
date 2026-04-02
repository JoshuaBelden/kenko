<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"

  let plans = $state(page.data.plans ?? [])
  let exercises = $state(page.data.exercises ?? [])
  $effect(() => {
    plans = page.data.plans ?? []
    exercises = page.data.exercises ?? []
  })

  let creating = $state(false)
  let editingPlanId = $state<string | null>(null)
  let deletingId = $state<string | null>(null)
  let formError = $state("")

  // Plan form
  let fPlanName = $state("")
  let fSessions = $state<any[]>([])

  // Session editing
  let editingSessionIdx = $state<number | null>(null)
  let sName = $state("")
  let sTargetDay = $state<number | null>(null)
  let sExercises = $state<any[]>([])

  // Add exercise to session
  let addExerciseOpen = $state(false)
  let addExerciseId = $state("")
  let addTargetSets = $state("3")
  let addTargetReps = $state("10")
  let addTargetWeight = $state("")
  let addRestSeconds = $state("90")

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  function exerciseName(exerciseId: string): string {
    return exercises.find((e: any) => e.id === exerciseId)?.name ?? "Unknown"
  }

  function resetPlanForm() {
    fPlanName = ""
    fSessions = []
    editingSessionIdx = null
    formError = ""
  }

  function startCreatePlan() {
    creating = true
    editingPlanId = null
    resetPlanForm()
  }

  function startEditPlan(plan: any) {
    editingPlanId = plan.id
    creating = false
    fPlanName = plan.name
    fSessions = plan.sessions.map((s: any) => ({
      id: s.id,
      name: s.name,
      targetDayOfWeek: s.targetDayOfWeek,
      exercises: s.exercises.map((e: any) => ({ ...e })),
    }))
    editingSessionIdx = null
    formError = ""
  }

  function addSession() {
    fSessions = [...fSessions, { name: "Session " + (fSessions.length + 1), targetDayOfWeek: null, exercises: [] }]
    editingSessionIdx = fSessions.length - 1
    sName = fSessions[fSessions.length - 1].name
    sTargetDay = null
    sExercises = []
  }

  function editSession(idx: number) {
    editingSessionIdx = idx
    const s = fSessions[idx]
    sName = s.name
    sTargetDay = s.targetDayOfWeek
    sExercises = s.exercises.map((e: any) => ({ ...e }))
  }

  function saveSession() {
    if (editingSessionIdx === null) return
    fSessions[editingSessionIdx] = {
      ...fSessions[editingSessionIdx],
      name: sName,
      targetDayOfWeek: sTargetDay,
      exercises: sExercises,
    }
    fSessions = [...fSessions]
    editingSessionIdx = null
  }

  function removeSession(idx: number) {
    fSessions = fSessions.filter((_, i) => i !== idx)
    if (editingSessionIdx === idx) editingSessionIdx = null
  }

  function openAddExercise() {
    addExerciseOpen = true
    addExerciseId = exercises[0]?.id ?? ""
    addTargetSets = "3"
    addTargetReps = "10"
    addTargetWeight = ""
    addRestSeconds = "90"
  }

  function confirmAddExercise() {
    if (!addExerciseId) return
    sExercises = [...sExercises, {
      exerciseId: addExerciseId,
      order: sExercises.length,
      targetSets: parseInt(addTargetSets) || 3,
      targetReps: parseInt(addTargetReps) || 10,
      targetWeight: addTargetWeight ? parseFloat(addTargetWeight) : null,
      restSeconds: parseInt(addRestSeconds) || 90,
    }]
    addExerciseOpen = false
  }

  function removeExerciseFromSession(idx: number) {
    sExercises = sExercises.filter((_, i) => i !== idx).map((e, i) => ({ ...e, order: i }))
  }

  function moveExercise(idx: number, direction: -1 | 1) {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= sExercises.length) return
    const copy = [...sExercises]
    ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
    sExercises = copy.map((e, i) => ({ ...e, order: i }))
  }

  async function handleCreatePlan() {
    if (!fPlanName.trim()) {
      formError = "Plan name is required"
      return
    }

    const res = await fetch("/api/dojo/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fPlanName.trim(),
        sessions: fSessions.map(s => ({
          name: s.name,
          targetDayOfWeek: s.targetDayOfWeek,
          exercises: s.exercises,
        })),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      formError = data.error ?? "Failed to create plan"
      return
    }

    creating = false
    resetPlanForm()
    await invalidateAll()
  }

  async function handleUpdatePlan() {
    if (!fPlanName.trim()) {
      formError = "Plan name is required"
      return
    }

    // Update name
    await fetch(`/api/dojo/plans/${editingPlanId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fPlanName.trim() }),
    })

    // Delete existing sessions and re-add — simplest approach for full rewrite
    const existingPlan = plans.find((p: any) => p.id === editingPlanId)
    if (existingPlan) {
      for (const s of existingPlan.sessions) {
        await fetch(`/api/dojo/plans/${editingPlanId}/sessions/${s.id}`, { method: "DELETE" })
      }
    }

    for (const s of fSessions) {
      await fetch(`/api/dojo/plans/${editingPlanId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          targetDayOfWeek: s.targetDayOfWeek,
          exercises: s.exercises,
        }),
      })
    }

    editingPlanId = null
    resetPlanForm()
    await invalidateAll()
  }

  async function handleDeletePlan(id: string) {
    await fetch(`/api/dojo/plans/${id}`, { method: "DELETE" })
    deletingId = null
    await invalidateAll()
  }

  function startSession(planId: string, sessionId: string) {
    goto(`/dojo?startPlan=${planId}&startSession=${sessionId}`)
  }
</script>

<PageHeader kanji="道場" title="Workout Plans" subtitle="Design your training programs" />

<div class="plans-controls">
  {#if !creating && !editingPlanId}
    <Button variant="primary" onclick={startCreatePlan}>+ New Plan</Button>
  {/if}
</div>

{#if creating || editingPlanId}
  <Card>
    <div class="form">
      <h3 class="form-title">{creating ? "New Plan" : "Edit Plan"}</h3>

      <div class="form-field">
        <label class="field-label">Plan Name</label>
        <input type="text" class="field-input" bind:value={fPlanName} placeholder="e.g. Push Pull Legs" />
      </div>

      <div class="sessions-section">
        <div class="sessions-header">
          <span class="field-label">Sessions ({fSessions.length})</span>
          <Button variant="secondary" onclick={addSession}>+ Session</Button>
        </div>

        {#each fSessions as session, idx}
          <div class="session-card" class:editing={editingSessionIdx === idx}>
            {#if editingSessionIdx === idx}
              <div class="session-edit">
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label">Session Name</label>
                    <input type="text" class="field-input" bind:value={sName} />
                  </div>
                  <div class="form-field">
                    <label class="field-label">Target Day</label>
                    <select class="field-input" bind:value={sTargetDay}>
                      <option value={null}>Any</option>
                      {#each DAY_NAMES as day, i}
                        <option value={i}>{day}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                <div class="session-exercises">
                  <span class="field-label">Exercises ({sExercises.length})</span>
                  {#each sExercises as ex, exIdx}
                    <div class="session-exercise-row">
                      <span class="exercise-order">{exIdx + 1}.</span>
                      <span class="exercise-name-inline">{exerciseName(ex.exerciseId)}</span>
                      <span class="exercise-targets">{ex.targetSets}x{ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight}lbs` : ""}</span>
                      <span class="exercise-rest">{ex.restSeconds}s rest</span>
                      <div class="reorder-btns">
                        <button class="action-btn" onclick={() => moveExercise(exIdx, -1)} disabled={exIdx === 0}>&#x25B2;</button>
                        <button class="action-btn" onclick={() => moveExercise(exIdx, 1)} disabled={exIdx === sExercises.length - 1}>&#x25BC;</button>
                      </div>
                      <button class="action-btn delete" onclick={() => removeExerciseFromSession(exIdx)}>&#x2715;</button>
                    </div>
                  {/each}

                  {#if addExerciseOpen}
                    <div class="add-exercise-form">
                      <select class="field-input" bind:value={addExerciseId}>
                        {#each exercises as ex}
                          <option value={ex.id}>{ex.name}</option>
                        {/each}
                      </select>
                      <div class="form-row compact">
                        <div class="form-field">
                          <label class="field-label">Sets</label>
                          <input type="number" class="field-input" bind:value={addTargetSets} min="1" />
                        </div>
                        <div class="form-field">
                          <label class="field-label">Reps</label>
                          <input type="number" class="field-input" bind:value={addTargetReps} min="1" />
                        </div>
                        <div class="form-field">
                          <label class="field-label">Weight (lbs)</label>
                          <input type="number" class="field-input" bind:value={addTargetWeight} placeholder="opt" />
                        </div>
                        <div class="form-field">
                          <label class="field-label">Rest (s)</label>
                          <input type="number" class="field-input" bind:value={addRestSeconds} min="0" />
                        </div>
                      </div>
                      <div class="form-actions">
                        <Button variant="secondary" onclick={() => (addExerciseOpen = false)}>Cancel</Button>
                        <Button variant="primary" onclick={confirmAddExercise}>Add</Button>
                      </div>
                    </div>
                  {:else if exercises.length > 0}
                    <button class="add-exercise-btn" onclick={openAddExercise}>+ Add Exercise</button>
                  {:else}
                    <p class="hint">Create exercises in the <a href="/dojo/library">library</a> first</p>
                  {/if}
                </div>

                <div class="form-actions">
                  <Button variant="secondary" onclick={() => removeSession(idx)}>Remove Session</Button>
                  <Button variant="primary" onclick={saveSession}>Done</Button>
                </div>
              </div>
            {:else}
              <div class="session-summary" role="button" tabindex="0" onclick={() => editSession(idx)} onkeydown={e => e.key === 'Enter' && editSession(idx)}>
                <div class="session-summary-header">
                  <strong>{session.name}</strong>
                  {#if session.targetDayOfWeek !== null}
                    <span class="day-badge">{DAY_NAMES[session.targetDayOfWeek]}</span>
                  {/if}
                </div>
                <span class="session-exercise-count">{session.exercises.length} exercises</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if formError}
        <p class="form-error">{formError}</p>
      {/if}

      <div class="form-actions">
        <Button variant="secondary" onclick={() => { creating = false; editingPlanId = null; resetPlanForm() }}>Cancel</Button>
        <Button variant="primary" onclick={creating ? handleCreatePlan : handleUpdatePlan}>
          {creating ? "Create Plan" : "Save Plan"}
        </Button>
      </div>
    </div>
  </Card>
{/if}

{#each plans as plan (plan.id)}
  {#if editingPlanId !== plan.id}
    <Card>
      <div class="plan-card">
        <div class="plan-header">
          <h3 class="plan-name">{plan.name}</h3>
          <span class="plan-sessions-count">{plan.sessions.length} {plan.sessions.length === 1 ? "session" : "sessions"}</span>
        </div>

        {#each plan.sessions as session}
          <div class="plan-session">
            <div class="plan-session-header">
              <span class="plan-session-name">{session.name}</span>
              {#if session.targetDayOfWeek !== null}
                <span class="day-badge">{DAY_NAMES[session.targetDayOfWeek]}</span>
              {/if}
              <Button variant="ghost" onclick={() => startSession(plan.id, session.id)}>Start</Button>
            </div>
            <div class="plan-session-exercises">
              {#each session.exercises as ex, i}
                <span class="plan-exercise-item">
                  {exerciseName(ex.exerciseId)} — {ex.targetSets}x{ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight}lbs` : ""}
                </span>
              {/each}
            </div>
          </div>
        {/each}

        {#if deletingId === plan.id}
          <div class="confirm-delete">
            <span class="confirm-text">Delete this plan? Existing logs keep their snapshots.</span>
            <Button variant="secondary" onclick={() => (deletingId = null)}>No</Button>
            <Button variant="primary" onclick={() => handleDeletePlan(plan.id)}>Yes, Delete</Button>
          </div>
        {:else}
          <div class="plan-actions">
            <button class="action-btn" onclick={() => startEditPlan(plan)}>Edit</button>
            <button class="action-btn delete" onclick={() => (deletingId = plan.id)}>Delete</button>
          </div>
        {/if}
      </div>
    </Card>
  {/if}
{/each}

{#if plans.length === 0 && !creating}
  <div class="empty-state">
    <p>No workout plans yet. Create a plan to start training.</p>
  </div>
{/if}

<style>
  .plans-controls {
    margin-bottom: var(--space-6);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
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
    transition: border-color var(--transition-fast);
  }

  .field-input:focus {
    border-bottom-color: var(--border-strong);
  }

  select.field-input {
    padding: var(--space-2) var(--space-1);
    cursor: pointer;
  }

  .form-row {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .form-row.compact {
    gap: var(--space-2);
  }

  .form-error {
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .sessions-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .session-card {
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
  }

  .session-card.editing {
    background: var(--paper-warm);
  }

  .session-edit {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .session-exercises {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .session-exercise-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-1) 0;
  }

  .exercise-order {
    color: var(--ink-faint);
    min-width: 20px;
  }

  .exercise-name-inline {
    flex: 1;
    color: var(--ink);
    font-weight: 500;
  }

  .exercise-targets {
    color: var(--ink-light);
    font-size: var(--text-xs);
  }

  .exercise-rest {
    color: var(--ink-faint);
    font-size: var(--text-xs);
  }

  .reorder-btns {
    display: flex;
    gap: 2px;
  }

  .action-btn {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    background: none;
    border: none;
    color: var(--ink-faint);
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .action-btn:hover {
    color: var(--ink);
  }

  .action-btn.delete:hover {
    color: var(--accent);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .add-exercise-btn {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2);
    background: none;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .add-exercise-btn:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .add-exercise-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--paper-card);
  }

  .hint {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .hint a {
    color: var(--accent);
  }

  .session-summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background var(--transition-fast);
  }

  .session-summary:hover {
    background: var(--paper-warm);
  }

  .session-summary-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .session-exercise-count {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .day-badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--paper-warm);
    color: var(--ink-light);
  }

  /* Plan display cards */
  .plan-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .plan-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .plan-name {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .plan-sessions-count {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .plan-session {
    padding: var(--space-2) 0;
    border-top: 0.5px solid var(--border);
  }

  .plan-session-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .plan-session-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
    flex: 1;
  }

  .plan-session-exercises {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .plan-exercise-item {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    padding-left: var(--space-3);
  }

  .plan-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
  }

  .confirm-delete {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
    flex: 1;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }
</style>
