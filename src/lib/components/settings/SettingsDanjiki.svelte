<script lang="ts">
  import { Card } from "$lib/components"

  interface Props {
    weeklyFastingHours: string
    onchange: (field: string, value: any) => void
  }

  let { weeklyFastingHours, onchange }: Props = $props()
</script>

<Card>
  <h3 class="card-title">Danjiki — Fasting</h3>
  <div class="settings-fields">
    <div class="field">
      <label class="field-label" for="s-fasting">Weekly fasting hours target</label>
      <input
        id="s-fasting"
        type="number"
        value={weeklyFastingHours}
        oninput={(e) => onchange("weeklyFastingHours", e.currentTarget.value)}
        placeholder="e.g. 16"
      />
    </div>
  </div>
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
</style>
