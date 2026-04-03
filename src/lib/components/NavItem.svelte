<script lang="ts">
  import type { Snippet } from "svelte"

  interface Props {
    href: string
    label: string
    kanji?: string
    active?: boolean
    onclick?: () => void
    children?: Snippet
  }

  let { href, label, kanji, active = false, onclick, children }: Props = $props()
</script>

<a {href} class="nav-item" class:active {onclick}>
  {#if children}
    <span class="nav-icon">
      {@render children()}
    </span>
  {/if}
  <span class="nav-label">
    {#if kanji}<span class="nav-kanji">{kanji}</span>{/if}
    {label}
  </span>
</a>

<style>
  .nav-item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: var(--ink-light);
    transition: all var(--transition-fast);
  }

  .nav-item:hover {
    color: var(--ink);
    background: var(--paper-warm);
  }

  .nav-item.active {
    color: var(--accent);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .nav-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 400;
    letter-spacing: 0.05em;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    white-space: nowrap;
  }

  .nav-kanji {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    opacity: 0.5;
  }
</style>
