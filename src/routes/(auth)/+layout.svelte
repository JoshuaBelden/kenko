<script lang="ts">
  import type { Snippet } from "svelte"

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()
</script>

<div class="auth-layout">
  <div class="auth-brand">
    <span class="auth-kanji">健</span>
    <span class="auth-text">Kenko</span>
  </div>
  {@render children()}
</div>

<style>
  .auth-layout {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .auth-brand {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-8);
  }

  .auth-kanji {
    font-family: var(--font-display);
    font-size: var(--text-4xl);
    font-weight: 500;
    color: var(--ink);
  }

  .auth-text {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 400;
    color: var(--ink-light);
  }
</style>
