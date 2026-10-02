<script lang="ts">
  import type { Snippet } from "svelte"
  import { slide } from "svelte/transition"
  import Card from "./Card.svelte"

  interface Props {
    title: string
    /** Inner SVG markup for a 24×24 stroke icon */
    icon: string
    collapsed: boolean
    onToggle: () => void
    /** Pointer handlers for the drag handle; the parent owns the order */
    onDragStart: (e: PointerEvent) => void
    onDragMove: (e: PointerEvent) => void
    onDragEnd: () => void
    /** Keyboard reorder: -1 moves earlier, 1 moves later */
    onMove: (direction: -1 | 1) => void
    headerExtra?: Snippet
    children: Snippet
  }

  let { title, icon, collapsed, onToggle, onDragStart, onDragMove, onDragEnd, onMove, headerExtra, children }: Props =
    $props()

  function onHandleKeydown(e: KeyboardEvent) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return
    e.preventDefault()
    onMove(e.key === "ArrowUp" ? -1 : 1)
  }
</script>

<Card>
  <div class="widget">
    <div class="widget-header">
      <button
        type="button"
        class="drag-handle"
        aria-label="Reorder {title} (Alt+Arrow keys)"
        title="Drag to reorder"
        onpointerdown={onDragStart}
        onpointermove={onDragMove}
        onpointerup={onDragEnd}
        onpointercancel={onDragEnd}
        onkeydown={onHandleKeydown}
      >
        <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" /><circle cx="9" cy="3" r="1.5" />
          <circle cx="3" cy="9" r="1.5" /><circle cx="9" cy="9" r="1.5" />
          <circle cx="3" cy="15" r="1.5" /><circle cx="9" cy="15" r="1.5" />
        </svg>
      </button>
      <h3 class="widget-title">
        <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icon}</svg>
        {title}
      </h3>
      <div class="widget-actions">
        {#if headerExtra && !collapsed}
          {@render headerExtra()}
        {/if}
        <button
          type="button"
          class="collapse-btn"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onclick={onToggle}
        >
          <svg class="chevron" class:chevron-collapsed={collapsed} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>

    {#if !collapsed}
      <div class="widget-body" transition:slide={{ duration: 180 }}>
        {@render children()}
      </div>
    {/if}
  </div>
</Card>

<style>
  .widget {
    display: flex;
    flex-direction: column;
  }

  .widget-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .widget-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .widget-icon {
    flex-shrink: 0;
  }

  .widget-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .widget-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-4);
  }

  .drag-handle,
  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: var(--space-1);
    color: var(--ink-faint);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .drag-handle {
    cursor: grab;
    /* Only the handle opts out of touch scrolling so the page still scrolls */
    touch-action: none;
    margin-left: calc(-1 * var(--space-2));
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .collapse-btn {
    cursor: pointer;
  }

  .drag-handle:hover,
  .collapse-btn:hover {
    color: var(--ink);
  }

  .chevron {
    transition: transform var(--transition-fast);
  }

  .chevron-collapsed {
    transform: rotate(-90deg);
  }
</style>
