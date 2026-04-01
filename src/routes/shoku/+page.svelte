<script lang="ts">
  import { Button, Card, HabitPip, Input, PageHeader, ProgressBar, StatNumber } from "$lib/components"
</script>

<PageHeader kanji="食" title="Shoku" subtitle="Nourish with intention" />

<section class="section">
  <h3>Hydration</h3>
  <Card>
    <div class="hydration-row">
      <div class="pips">
        <HabitPip status="done" />
        <HabitPip status="done" />
        <HabitPip status="done" />
        <HabitPip status="done" />
        <HabitPip status="done" />
        <HabitPip status="done" />
        <HabitPip status="today" />
        <HabitPip status="pending" />
      </div>
      <StatNumber value="6 / 8" label="Glasses" size="sm" />
    </div>
    <div class="hydration-progress">
      <ProgressBar value={75} />
    </div>
  </Card>
</section>

<section class="section">
  <h3>Quick Log</h3>
  <Card>
    <form class="log-form">
      <Input name="food" label="Food" placeholder="What did you eat?" />
      <Input name="calories" label="Calories" type="number" placeholder="Estimated calories" />
      <div class="log-actions">
        <Button variant="primary" type="submit">Log meal</Button>
      </div>
    </form>
  </Card>
</section>

<section class="section">
  <h3>Today's Log</h3>
  <div class="meals-stack">
    <Card>
      <div class="meal-entry">
        <div class="meal-info">
          <span class="meal-label">Breakfast</span>
          <p class="meal-name">Oatmeal with berries</p>
        </div>
        <StatNumber value="320" label="cal" size="sm" />
      </div>
    </Card>
    <Card>
      <div class="meal-entry">
        <div class="meal-info">
          <span class="meal-label">Lunch</span>
          <p class="meal-name">Grilled salmon, rice, miso soup</p>
        </div>
        <StatNumber value="580" label="cal" size="sm" />
      </div>
    </Card>
    <Card>
      <div class="meal-entry">
        <div class="meal-info">
          <span class="meal-label">Snack</span>
          <p class="meal-name">Green tea, almonds</p>
        </div>
        <StatNumber value="150" label="cal" size="sm" />
      </div>
    </Card>
  </div>
</section>

<style>
  .section {
    margin-bottom: var(--space-8);
  }

  .section h3 {
    margin-bottom: var(--space-4);
  }

  .hydration-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  .pips {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .hydration-progress {
    margin-top: var(--space-2);
  }

  .log-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .log-actions {
    padding-top: var(--space-2);
  }

  .meals-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .meal-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .meal-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .meal-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .meal-name {
    font-size: var(--text-sm);
  }
</style>
