<script lang="ts">
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, ExerciseSearchModal } from "$lib/components"

  const planId = page.params.id!
  const exercises = $derived(page.data.exercises ?? [])

  let fPlanName = $state(page.data.plan.name)
  let fSessions = $state<any[]>(
    page.data.plan.sessions.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type ?? "strength",
      targetDayOfWeek: s.targetDayOfWeek,
      exercises: s.exercises.map((e: any) => ({ ...e })),
    })),
  )

  let editingSessionIdx = $state<number | null>(null)
  let editingExerciseIdx = $state<number | null>(null)

  let exerciseModalOpen = $state(false)

  let autoSaveTimer: ReturnType<typeof setTimeout> | undefined
  let saving = $state(false)
  let saveInFlight = false
  let savePending = false
  let confirmingDeletePlan = $state(false)

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  function findExercise(exerciseId: string): any | undefined {
    return exercises.find((e: any) => e.id === exerciseId)
  }

  function exerciseName(exerciseId: string): string {
    return findExercise(exerciseId)?.name ?? "Unknown"
  }

  function formatLabel(value: string): string {
    return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => persistPlan(), 800)
  }

  function addSession() {
    fSessions = [...fSessions, { name: "Session " + (fSessions.length + 1), type: "strength", targetDayOfWeek: null, exercises: [] }]
    editingSessionIdx = fSessions.length - 1
    scheduleAutoSave()
  }

  function removeSession(idx: number) {
    fSessions = fSessions.filter((_, i) => i !== idx)
    if (editingSessionIdx === idx) editingSessionIdx = null
    else if (editingSessionIdx !== null && editingSessionIdx > idx) editingSessionIdx--
    scheduleAutoSave()
  }

  function handleAddExercise(exercise: any) {
    if (editingSessionIdx === null) return
    fSessions[editingSessionIdx].exercises = [
      ...fSessions[editingSessionIdx].exercises,
      {
        exerciseId: exercise.exerciseId,
        order: fSessions[editingSessionIdx].exercises.length,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        targetWeight: exercise.targetWeight,
        restSeconds: exercise.restSeconds,
      },
    ]
    fSessions = [...fSessions]
    exerciseModalOpen = false
    scheduleAutoSave()
  }

  function removeExerciseFromSession(idx: number) {
    if (editingSessionIdx === null) return
    fSessions[editingSessionIdx].exercises = fSessions[editingSessionIdx].exercises
      .filter((_: any, i: number) => i !== idx)
      .map((e: any, i: number) => ({ ...e, order: i }))
    fSessions = [...fSessions]
    scheduleAutoSave()
  }

  function moveExercise(idx: number, direction: -1 | 1) {
    if (editingSessionIdx === null) return
    const exs = fSessions[editingSessionIdx].exercises
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= exs.length) return
    const copy = [...exs]
    ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
    fSessions[editingSessionIdx].exercises = copy.map((e: any, i: number) => ({ ...e, order: i }))
    fSessions = [...fSessions]
    scheduleAutoSave()
  }

  function handleSessionNameInput() {
    scheduleAutoSave()
  }

  function handleSessionDayChange() {
    scheduleAutoSave()
  }

  function handlePlanNameInput() {
    scheduleAutoSave()
  }

  function handleExerciseFieldChange() {
    fSessions = [...fSessions]
    scheduleAutoSave()
  }

  async function persistPlan() {
    if (!fPlanName.trim()) return

    if (saveInFlight) {
      savePending = true
      return
    }

    saveInFlight = true
    saving = true

    try {
      // Update name
      await fetch(`/api/dojo/plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fPlanName.trim() }),
      })

      // Fetch current server state to know which sessions to delete
      const planRes = await fetch(`/api/dojo/plans/${planId}`)
      const serverPlan = await planRes.json()

      // Delete all existing sessions on the server
      for (const s of serverPlan.sessions ?? []) {
        await fetch(`/api/dojo/plans/${planId}/sessions/${s.id}`, { method: "DELETE" })
      }

      // Re-add current form sessions
      for (const s of fSessions) {
        await fetch(`/api/dojo/plans/${planId}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: s.name,
            type: s.type ?? "strength",
            targetDayOfWeek: s.targetDayOfWeek,
            exercises: s.exercises,
          }),
        })
      }
    } finally {
      saving = false
      saveInFlight = false

      if (savePending) {
        savePending = false
        persistPlan()
      }
    }
  }

  async function handleDone() {
    clearTimeout(autoSaveTimer)
    await persistPlan()
    goto(`/dojo/plans/${planId}`)
  }

  async function handleDeletePlan() {
    clearTimeout(autoSaveTimer)
    await fetch(`/api/dojo/plans/${planId}`, { method: "DELETE" })
    goto("/dojo/plans")
  }

  async function exportPlan() {
    const res = await fetch(`/api/dojo/plans/${planId}/export`)
    if (!res.ok) return
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fPlanName.replace(/[^a-zA-Z0-9]/g, "_")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="edit-toolbar">
  <a class="back-link" href="/dojo/plans/{planId}">&larr; Back to Plan</a>
  <button class="edit-btn" onclick={exportPlan}>Export</button>
</div>

<Card>
  <div class="form">
    <div class="form-field">
      <label class="field-label">Plan Name</label>
      <input type="text" class="field-input" bind:value={fPlanName} oninput={handlePlanNameInput} placeholder="e.g. Push Pull Legs" />
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
                  <input type="text" class="field-input" bind:value={session.name} oninput={handleSessionNameInput} />
                </div>
                <div class="form-field">
                  <label class="field-label">Type</label>
                  <select class="field-input" bind:value={session.type} onchange={handleSessionDayChange}>
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="field-label">Target Day</label>
                  <select class="field-input" bind:value={session.targetDayOfWeek} onchange={handleSessionDayChange}>
                    <option value={null}>Any</option>
                    {#each DAY_NAMES as day, i}
                      <option value={i}>{day}</option>
                    {/each}
                  </select>
                </div>
              </div>

              {#if session.type !== "cardio"}
                <div class="session-exercises">
                  <span class="field-label">Exercises ({session.exercises.length})</span>
                  {#each session.exercises as ex, exIdx}
                    {@const exData = findExercise(ex.exerciseId)}
                    <div class="session-exercise-item" class:expanded={editingExerciseIdx === exIdx}>
                      <div
                        class="session-exercise-row"
                        role="button"
                        tabindex="0"
                        onclick={() => (editingExerciseIdx = editingExerciseIdx === exIdx ? null : exIdx)}
                        onkeydown={(e) => e.key === "Enter" && (editingExerciseIdx = editingExerciseIdx === exIdx ? null : exIdx)}
                      >
                        <span class="exercise-order">{exIdx + 1}.</span>
                        <span class="exercise-name-inline">{exData?.name ?? "Unknown"}</span>
                        {#if exData}
                          <span class="exercise-tag">{formatLabel(exData.muscleGroup.muscle)}</span>
                          <span class="exercise-tag">{formatLabel(exData.equipment)}</span>
                        {/if}
                        <span class="exercise-targets">{ex.targetSets}x{ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight}lbs` : ""}</span>
                        <span class="exercise-rest">{ex.restSeconds}s rest</span>
                        <div class="reorder-btns">
                          <button class="action-btn" onclick={(e) => { e.stopPropagation(); moveExercise(exIdx, -1) }} disabled={exIdx === 0}>&#x25B2;</button>
                          <button class="action-btn" onclick={(e) => { e.stopPropagation(); moveExercise(exIdx, 1) }} disabled={exIdx === session.exercises.length - 1}>&#x25BC;</button>
                        </div>
                        <button class="action-btn delete" onclick={(e) => { e.stopPropagation(); removeExerciseFromSession(exIdx) }}>&#x2715;</button>
                      </div>
                      {#if editingExerciseIdx === exIdx}
                        <div class="exercise-edit-fields">
                          <div class="exercise-edit-field">
                            <label class="field-label">Sets</label>
                            <input type="number" class="field-input" bind:value={ex.targetSets} oninput={handleExerciseFieldChange} min="1" />
                          </div>
                          <div class="exercise-edit-field">
                            <label class="field-label">Reps</label>
                            <input type="number" class="field-input" bind:value={ex.targetReps} oninput={handleExerciseFieldChange} min="1" />
                          </div>
                          <div class="exercise-edit-field">
                            <label class="field-label">Weight (lbs)</label>
                            <input type="number" class="field-input" bind:value={ex.targetWeight} oninput={handleExerciseFieldChange} placeholder="opt" />
                          </div>
                          <div class="exercise-edit-field">
                            <label class="field-label">Rest (s)</label>
                            <input type="number" class="field-input" bind:value={ex.restSeconds} oninput={handleExerciseFieldChange} min="0" />
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}

                  {#if exercises.length > 0}
                    <button class="add-exercise-btn" onclick={() => (exerciseModalOpen = true)}>+ Add Exercise</button>
                  {:else}
                    <p class="hint">Create exercises in the <a href="/dojo/library">library</a> first</p>
                  {/if}
                </div>
              {/if}

              <div class="form-actions">
                <Button variant="secondary" onclick={() => removeSession(idx)}>Remove Session</Button>
                <Button variant="primary" onclick={() => (editingSessionIdx = null)}>Done</Button>
              </div>
            </div>
          {:else}
            <div
              class="session-summary"
              role="button"
              tabindex="0"
              onclick={() => (editingSessionIdx = idx)}
              onkeydown={(e) => e.key === "Enter" && (editingSessionIdx = idx)}
            >
              <div class="session-summary-header">
                <strong>{session.name}</strong>
                {#if session.targetDayOfWeek !== null}
                  <span class="day-badge">{DAY_NAMES[session.targetDayOfWeek]}</span>
                {/if}
              </div>
              <span class="session-exercise-count">{session.type === "cardio" ? "Cardio" : `${session.exercises.length} exercises`}</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="form-actions">
      {#if confirmingDeletePlan}
        <div class="confirm-delete-inline">
          <span class="confirm-text">Delete?</span>
          <button class="confirm-btn yes" onclick={handleDeletePlan}>Yes</button>
          <button class="confirm-btn no" onclick={() => (confirmingDeletePlan = false)}>No</button>
        </div>
      {:else}
        <button class="delete-btn-sm" onclick={() => (confirmingDeletePlan = true)}>Delete</button>
      {/if}
      <div class="form-actions-right">
        <span class="save-status">{saving ? "Saving..." : ""}</span>
        <Button variant="secondary" onclick={handleDone}>Done</Button>
      </div>
    </div>
  </div>
</Card>

<ExerciseSearchModal
  open={exerciseModalOpen}
  {exercises}
  onclose={() => (exerciseModalOpen = false)}
  onadd={handleAddExercise}
/>

<style>
  .edit-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-6);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--ink);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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

  .form-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: space-between;
    align-items: center;
  }

  .form-actions-right {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .save-status {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
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

  .session-exercise-item {
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);
  }

  .session-exercise-item.expanded {
    background: var(--paper-card);
    padding: var(--space-2);
  }

  .session-exercise-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-1) 0;
    cursor: pointer;
  }

  .exercise-edit-fields {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-2) 0 var(--space-1) 20px;
  }

  .exercise-edit-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
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

  .exercise-tag {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: 1px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--paper-warm);
    color: var(--ink-light);
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

  .edit-btn {
    padding: var(--space-2) var(--space-5);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-light);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .edit-btn:hover {
    border-color: var(--ink);
    color: var(--ink);
  }

  .delete-btn-sm {
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--accent);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn-sm:hover {
    background: var(--accent);
    color: white;
  }

  .confirm-delete-inline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .confirm-btn {
    padding: var(--space-1) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .confirm-btn.yes {
    border-color: var(--accent);
    color: var(--accent);
  }

  .confirm-btn.yes:hover {
    background: var(--accent);
    color: white;
  }

  .confirm-btn.no {
    color: var(--ink-light);
  }

  .confirm-btn.no:hover {
    border-color: var(--ink-light);
  }
</style>
