<script lang="ts">
  interface Props {
    value: string | number
    label?: string
    size?: "sm" | "md" | "lg"
  }

  let { value, label, size = "md" }: Props = $props()
</script>

<div class="stat">
  <span class="stat-value stat-{size}">{value}</span>
  {#if label}
    <span class="stat-label">{label}</span>
  {/if}
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stat-value {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
  }

  .stat-sm {
    font-size: var(--text-xl);
  }
  .stat-md {
    font-size: var(--text-3xl);
  }
  .stat-lg {
    font-size: var(--text-4xl);
  }

  .stat-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }
</style>
