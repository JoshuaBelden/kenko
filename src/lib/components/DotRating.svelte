<script lang="ts">
  type Props = {
    value: number | null
    onchange?: (value: number | null) => void
    disabled?: boolean
  }

  let { value = null, onchange, disabled = false }: Props = $props()

  function select(dot: number) {
    if (disabled) return
    const newValue = value === dot ? null : dot
    onchange?.(newValue)
  }
</script>

<div class="dot-rating" class:disabled>
  {#each [1, 2, 3, 4, 5] as dot}
    <button
      type="button"
      class="dot"
      class:dot-filled={value != null && dot <= value}
      onclick={() => select(dot)}
      {disabled}
      aria-label="{dot} of 5"
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill={value != null && dot <= value ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
  {/each}
</div>

<style>
  .dot-rating {
    display: flex;
    gap: var(--space-2);
  }

  .dot {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: var(--ink-faint);
    transition: color var(--transition-fast);
    line-height: 0;
  }

  .dot:hover:not(:disabled) {
    color: var(--accent-green);
  }

  .dot-filled {
    color: var(--accent-green);
  }

  .disabled .dot {
    cursor: default;
    opacity: 0.6;
  }
</style>
