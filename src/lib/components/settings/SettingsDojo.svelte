<script lang="ts">
  import { Card } from "$lib/components"

  interface Props {
    allPlans: any[]
    selectedPlanIds: string[]
    sessionsPerWeek: string
    weeklyCalorieBurn: string
    onchange: (field: string, value: any) => void
  }

  let { allPlans, selectedPlanIds, sessionsPerWeek, weeklyCalorieBurn, onchange }: Props = $props()

  function togglePlan(id: string) {
    const newIds = selectedPlanIds.includes(id)
      ? selectedPlanIds.filter((i) => i !== id)
      : [...selectedPlanIds, id]
    onchange("selectedPlanIds", newIds)
  }
</script>

<Card>
  <h3 class="card-title">Dojo — Training</h3>
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
  }
</style>
