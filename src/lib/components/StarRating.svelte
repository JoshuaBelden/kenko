<script lang="ts">
  type Props = {
    value: number | null
    onchange?: (value: number | null) => void
    disabled?: boolean
  }

  let { value = null, onchange, disabled = false }: Props = $props()

  function select(star: number) {
    if (disabled) return
    // Re-tap same value clears
    const newValue = value === star ? null : star
    onchange?.(newValue)
  }
</script>

<div class="star-rating" class:disabled>
  {#each [1, 2, 3, 4, 5] as star}
    <button
      type="button"
      class="star"
      class:star-filled={value != null && star <= value}
      onclick={() => select(star)}
      {disabled}
      aria-label="{star} star{star > 1 ? 's' : ''}"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={value != null && star <= value ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  {/each}
</div>

<style>
  .star-rating {
    display: flex;
    gap: var(--space-1);
  }

  .star {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: var(--ink-faint);
    transition: color var(--transition-fast);
    line-height: 0;
  }

  .star:hover:not(:disabled) {
    color: var(--accent);
  }

  .star-filled {
    color: var(--accent);
  }

  .disabled .star {
    cursor: default;
    opacity: 0.6;
  }
</style>
