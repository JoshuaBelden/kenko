<script lang="ts">
  import { Card } from "$lib/components"
  import { WORKOUT_TYPE_LABEL_MAX_LENGTH, type WorkoutType } from "$lib/workoutTypes"

  interface Props {
    allPlans: any[]
    selectedPlanIds: string[]
    sessionsPerWeek: string
    weeklyCalorieBurn: string
    workoutTypes: WorkoutType[]
    onchange: (field: string, value: any) => void
  }

  let { allPlans, selectedPlanIds, sessionsPerWeek, weeklyCalorieBurn, workoutTypes, onchange }: Props = $props()

  let newTypeLabel = $state("")
  let confirmingRemoveIndex = $state<number | null>(null)

  function renameType(index: number, label: string) {
    onchange("workoutTypes", workoutTypes.map((t, i) => (i === index ? { ...t, label } : t)))
  }

  function removeType(index: number) {
    onchange("workoutTypes", workoutTypes.filter((_, i) => i !== index))
    confirmingRemoveIndex = null
  }

  function moveType(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= workoutTypes.length) return
    const next = [...workoutTypes]
    ;[next[index], next[target]] = [next[target], next[index]]
    confirmingRemoveIndex = null
    onchange("workoutTypes", next)
  }

  function addType() {
    const label = newTypeLabel.trim()
    if (!label) return
    if (workoutTypes.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      newTypeLabel = ""
      return
    }
    // Key is assigned by the server from the label
    onchange("workoutTypes", [...workoutTypes, { key: "", label }])
    newTypeLabel = ""
  }

  function togglePlan(id: string) {
    const newIds = selectedPlanIds.includes(id)
      ? selectedPlanIds.filter((i) => i !== id)
      : [...selectedPlanIds, id]
    onchange("selectedPlanIds", newIds)
  }
</script>

<Card>
  <h3 class="card-title">Workout</h3>
  <div class="settings-fields types-section">
    <div class="field">
      <span class="field-label">Workout types</span>
      <p class="module-hint">Activities available when you log a workout outside your plans.</p>
      <ul class="type-list">
        {#each workoutTypes as type, i (type.key || `new-${i}`)}
          <li class="type-row">
            <input
              type="text"
              aria-label="Workout type name"
              value={type.label}
              maxlength={WORKOUT_TYPE_LABEL_MAX_LENGTH}
              oninput={(e) => renameType(i, e.currentTarget.value)}
            />
            <button type="button" class="icon-btn" aria-label="Move up" disabled={i === 0} onclick={() => moveType(i, -1)}>↑</button>
            <button type="button" class="icon-btn" aria-label="Move down" disabled={i === workoutTypes.length - 1} onclick={() => moveType(i, 1)}>↓</button>
            {#if confirmingRemoveIndex === i}
              <span class="confirm-text">Remove?</span>
              <button type="button" class="text-btn danger" onclick={() => removeType(i)}>Yes</button>
              <button type="button" class="text-btn" onclick={() => (confirmingRemoveIndex = null)}>No</button>
            {:else}
              <button
                type="button"
                class="text-btn danger"
                disabled={workoutTypes.length <= 1}
                onclick={() => (confirmingRemoveIndex = i)}
              >Remove</button>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="type-add">
        <input
          type="text"
          aria-label="New workout type"
          placeholder="Add a type, e.g. Pickleball"
          maxlength={WORKOUT_TYPE_LABEL_MAX_LENGTH}
          bind:value={newTypeLabel}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addType()
            }
          }}
        />
        <button type="button" class="text-btn" disabled={!newTypeLabel.trim()} onclick={addType}>Add</button>
      </div>
    </div>
  </div>

  {#if allPlans.length === 0}
    <p class="module-hint">
      <a href="/dojo/plans">Add workout plans</a> to configure training targets.
    </p>
  {:else}
    <div class="settings-fields">
      <div class="field">
        <span class="field-label">Workout plans</span>
        <div class="checkbox-list">
          {#each allPlans as plan}
            <label class="checkbox-item">
              <input
                type="checkbox"
                checked={selectedPlanIds.includes(plan.id)}
                onchange={() => togglePlan(plan.id)}
              />
              <span>{plan.name}</span>
            </label>
          {/each}
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field-label" for="s-sessions">Sessions/week</label>
          <input
            id="s-sessions"
            type="number"
            value={sessionsPerWeek}
            oninput={(e) => onchange("sessionsPerWeek", e.currentTarget.value)}
            placeholder="Optional"
          />
        </div>
        <div class="field">
          <label class="field-label" for="s-burn">Weekly calorie burn target</label>
          <input
            id="s-burn"
            type="number"
            value={weeklyCalorieBurn}
            oninput={(e) => onchange("weeklyCalorieBurn", e.currentTarget.value)}
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  {/if}
</Card>

<style>
  .card-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0 0 var(--space-4) 0;
  }

  .settings-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 480px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-row {
    display: flex;
    gap: var(--space-4);
  }

  .field-row .field {
    flex: 1;
  }

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    transition: border-color var(--transition-fast);
    width: 100%;
  }

  .field input:focus {
    border-bottom-color: var(--border-strong);
  }

  .field input::placeholder {
    color: var(--ink-faint);
  }

  .module-hint {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .module-hint a {
    color: var(--accent);
    text-decoration: none;
  }

  .module-hint a:hover {
    text-decoration: underline;
  }

  .types-section {
    margin-bottom: var(--space-5);
  }

  .type-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .type-row,
  .type-add {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .type-row input,
  .type-add input {
    flex: 1;
    min-width: 0;
    padding: var(--space-2) 0;
  }

  .icon-btn,
  .text-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    padding: var(--space-1) var(--space-2);
  }

  .icon-btn:disabled,
  .text-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .text-btn.danger {
    color: var(--accent-red);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .checkbox-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .checkbox-item input {
    margin-top: 2px;
    accent-color: var(--accent);
    width: auto;
  }
</style>
