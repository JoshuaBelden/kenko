<script lang="ts">
  import { Card } from "$lib/components"

  interface Props {
    allCommitments: any[]
    selectedCommitmentIds: string[]
    onchange: (field: string, value: any) => void
  }

  let { allCommitments, selectedCommitmentIds, onchange }: Props = $props()

  function toggleCommitment(id: string) {
    const newIds = selectedCommitmentIds.includes(id)
      ? selectedCommitmentIds.filter((i) => i !== id)
      : [...selectedCommitmentIds, id]
    onchange("selectedCommitmentIds", newIds)
  }
</script>

<Card>
  <h3 class="card-title">Kata — Commitments</h3>
  {#if allCommitments.length === 0}
    <p class="module-hint">
      <a href="/kata">Add commitments</a> to track habits within this journey.
    </p>
  {:else}
    <div class="settings-fields">
      <div class="field">
        <span class="field-label">Commitments</span>
        <div class="checkbox-list">
          {#each allCommitments as commitment}
            <label class="checkbox-item">
              <input
                type="checkbox"
                checked={selectedCommitmentIds.includes(commitment.id)}
                onchange={() => toggleCommitment(commitment.id)}
              />
              <div class="commitment-info">
                <span>{commitment.name}</span>
                <span class="commitment-meta">{commitment.period} &middot; target: {commitment.targetValue}{commitment.unit ? ` ${commitment.unit}` : ""}</span>
              </div>
            </label>
          {/each}
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

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
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

  .commitment-info {
    display: flex;
    flex-direction: column;
  }

  .commitment-meta {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }
</style>
