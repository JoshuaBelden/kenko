<script lang="ts">
  interface Props {
    status: "done" | "today" | "pending"
  }

  let { status }: Props = $props()
</script>

<span class="pip pip-{status}" aria-label={status}></span>

<style>
  .pip {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pip-done {
    background: var(--accent-green);
  }

  .pip-today {
    background: var(--accent);
  }

  .pip-pending {
    background: var(--ink-faint);
  }
</style>
