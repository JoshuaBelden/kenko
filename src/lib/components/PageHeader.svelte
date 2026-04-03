<script lang="ts">
  interface Props {
    icon?: string
    title: string
    subtitle?: string
  }

  let { icon, title, subtitle }: Props = $props()
</script>

<header class="page-header">
  <div class="page-title-row">
    {#if icon}
      <svg
        class="page-icon"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {@html icon}
      </svg>
    {/if}
    <h2>{title}</h2>
  </div>
  {#if subtitle}
    <p class="page-subtitle">{subtitle}</p>
  {/if}
</header>

<style>
  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-8);
  }

  .page-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .page-icon {
    color: var(--ink-faint);
    opacity: 0.4;
    flex-shrink: 0;
  }

  h2 {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    font-weight: 500;
    color: var(--ink);
  }

  .page-subtitle {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 300;
    color: var(--ink-light);
  }
</style>
