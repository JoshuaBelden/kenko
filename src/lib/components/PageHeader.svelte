<script lang="ts">
  interface Props {
    kanji?: string
    title: string
    subtitle?: string
  }

  let { kanji, title, subtitle }: Props = $props()
</script>

<header class="page-header">
  <div class="page-title-row">
    {#if kanji}
      <span class="page-kanji">{kanji}</span>
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
    align-items: baseline;
    gap: var(--space-3);
  }

  .page-kanji {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--ink-faint);
    line-height: 1;
    opacity: 0.3;
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
