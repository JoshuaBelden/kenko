<script lang="ts">
  import type { Snippet } from "svelte"

  interface Props {
    variant?: "primary" | "secondary" | "ghost"
    type?: "button" | "submit" | "reset"
    href?: string
    disabled?: boolean
    onclick?: () => void
    children: Snippet
  }

  let { variant = "primary", type = "button", href, disabled = false, onclick, children }: Props = $props()
</script>

{#if href}
  <a {href} class="btn btn-{variant}" class:disabled>
    {@render children()}
  </a>
{:else}
  <button {type} class="btn btn-{variant}" {disabled} {onclick}>
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    letter-spacing: 0.05em;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    text-decoration: none;
    border: none;
  }

  .btn:disabled,
  .btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-secondary {
    background: transparent;
    color: var(--ink);
    border: 0.5px solid var(--border-strong);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--ink-faint);
  }

  .btn-ghost {
    background: transparent;
    color: var(--ink-light);
    border: none;
  }

  .btn-ghost:hover:not(:disabled) {
    color: var(--ink);
  }
</style>
