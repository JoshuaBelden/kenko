<script lang="ts">
  interface Props {
    value: number
    label?: string
  }

  let { value, label }: Props = $props()

  const clamped = $derived(Math.min(100, Math.max(0, value)))
</script>

<div class="progress-wrapper">
  {#if label}
    <div class="progress-header">
      <span class="progress-label">{label}</span>
      <span class="progress-value">{clamped}%</span>
    </div>
  {/if}
  <div class="progress-track">
    <div class="progress-fill" style:width="{clamped}%"></div>
  </div>
</div>

<style>
  .progress-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .progress-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .progress-value {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-light);
  }

  .progress-track {
    height: 2px;
    background: var(--paper-warm);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-green);
    border-radius: var(--radius-pill);
    transition: width var(--transition-base);
  }
</style>
