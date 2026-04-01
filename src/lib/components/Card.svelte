<script lang="ts">
  import type { Snippet } from "svelte"

  interface Props {
    padding?: string
    children: Snippet
  }

  let { padding = "var(--space-6)", children }: Props = $props()
</script>

<div class="card" style:padding>
  {@render children()}
</div>

<style>
  .card {
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-md);
  }
</style>
