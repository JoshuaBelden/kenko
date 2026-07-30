<script lang="ts">
  import { tooltipState } from "$lib/tooltip.svelte"
</script>

{#if tooltipState.visible}
  <div class="tooltip" style:left="{tooltipState.x}px" style:top="{tooltipState.y}px">
    {tooltipState.content}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    transform: translate(-50%, -100%) translateY(-10px);
    pointer-events: none;
    z-index: 1000;
    background: var(--ink);
    color: var(--paper);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
</style>
