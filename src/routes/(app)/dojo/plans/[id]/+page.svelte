<script lang="ts">
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"

  const plan = $derived(page.data.plan)
  const exercises = $derived(page.data.exercises ?? [])

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  let expandedSessionId = $state<string | null>(null)

  function toggleSession(id: string) {
    expandedSessionId = expandedSessionId === id ? null : id
  }

  function findExercise(exerciseId: string): any | undefined {
    return exercises.find((e: any) => e.id === exerciseId)
  }

  function exerciseName(exerciseId: string): string {
    return findExercise(exerciseId)?.name ?? "Unknown"
  }

  async function exportPlan() {
    const res = await fetch(`/api/dojo/plans/${plan.id}/export`)
    if (!res.ok) return
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${plan.name.replace(/[^a-zA-Z0-9]/g, "_")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<PageHeader icon={icons.dojo} title={plan.name} subtitle="View workout plan" />

<div class="view-toolbar">
  <a class="back-link" href="/dojo/plans">&larr; Back to Plans</a>
  <div class="view-toolbar-actions">
    <button class="edit-btn" onclick={exportPlan}>Export</button>
    <Button variant="primary" href="/dojo/plans/{plan.id}/edit">Edit</Button>
  </div>
</div>

<div class="plan-sessions">
  {#each plan.sessions as session (session.id)}
    <Card>
      <div class="plan-session" class:expanded={expandedSessionId === session.id}>
        <div
          class="plan-session-header"
          role="button"
          tabindex="0"
          onclick={() => toggleSession(session.id)}
          onkeydown={(e) => e.key === "Enter" && toggleSession(session.id)}
        >
          <span class="plan-session-name">{session.name}</span>
          {#if session.targetDayOfWeek !== null}
            <span class="day-badge">{DAY_NAMES[session.targetDayOfWeek]}</span>
          {/if}
          <span class="session-exercise-count">{session.type === "cardio" ? "Cardio" : `${session.exercises.length} exercises`}</span>
        </div>

        {#if expandedSessionId === session.id}
          <div class="plan-session-exercises">
            {#if session.type === "cardio"}
              <span class="plan-exercise-item">Cardio session</span>
            {:else if session.exercises.length === 0}
              <span class="plan-exercise-item">No exercises added</span>
            {:else}
              {#each session.exercises as ex}
                <span class="plan-exercise-item">
                  {exerciseName(ex.exerciseId)} — {ex.targetSets}x{ex.targetReps}{ex.targetWeight ? ` @ ${ex.targetWeight}lbs` : ""}
                </span>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </Card>
  {/each}
</div>

{#if plan.sessions.length === 0}
  <div class="empty-state">
    <p>This plan has no sessions yet. Edit the plan to add some.</p>
  </div>
{/if}

<style>
  .view-toolbar {
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

  .view-toolbar-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .plan-sessions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .plan-session-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }

  .plan-session-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
    flex: 1;
  }

  .day-badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--paper-warm);
    color: var(--ink-light);
  }

  .session-exercise-count {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .plan-session-exercises {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
  }

  .plan-exercise-item {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    padding-left: var(--space-3);
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

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }
</style>
