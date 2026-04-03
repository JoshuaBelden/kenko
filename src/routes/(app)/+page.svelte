<script lang="ts">
  import { Card, PageHeader, ProgressBar, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"
</script>

<PageHeader icon={icons.dashboard} title="Dashboard" subtitle="Your wellness at a glance" />

<div class="stats-grid">
  <Card>
    <StatNumber value="8,421" label="Steps today" size="sm" />
  </Card>
  <Card>
    <StatNumber value="6 / 8" label="Glasses of water" size="sm" />
  </Card>
  <Card>
    <StatNumber value="14" label="Day streak" size="sm" />
  </Card>
  <Card>
    <StatNumber value="165" label="Weight (lbs)" size="sm" />
  </Card>
</div>

<section class="section">
  <h3>Progression</h3>
  <Card>
    <div class="progress-stack">
      <ProgressBar value={72} label="Weekly activity" />
      <ProgressBar value={85} label="Nutrition goal" />
      <ProgressBar value={60} label="Hydration" />
    </div>
  </Card>
</section>

<section class="section">
  <h3>Body Metrics</h3>
  <div class="metrics-grid">
    <Card>
      <StatNumber value="22.1" label="BMI" size="sm" />
    </Card>
    <Card>
      <StatNumber value="62" label="Resting HR" size="sm" />
    </Card>
    <Card>
      <StatNumber value="7.5h" label="Avg sleep" size="sm" />
    </Card>
  </div>
</section>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-8);
  }

  @media (min-width: 480px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .section {
    margin-bottom: var(--space-8);
  }

  .section h3 {
    margin-bottom: var(--space-4);
  }

  .progress-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  @media (min-width: 480px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 768px) {
    .metrics-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
