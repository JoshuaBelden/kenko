<script lang="ts">
  import { Card, HabitPip, PageHeader, StatNumber } from "$lib/components"

  const habits = [
    { name: "Meditation", streak: 21, days: ["done", "done", "done", "done", "done", "today", "pending"] as const },
    { name: "Reading", streak: 14, days: ["done", "done", "done", "pending", "done", "done", "pending"] as const },
    { name: "Exercise", streak: 7, days: ["done", "done", "done", "done", "done", "today", "pending"] as const },
    { name: "Journaling", streak: 5, days: ["done", "pending", "done", "done", "done", "today", "pending"] as const },
  ]

  const weekdays = ["M", "T", "W", "T", "F", "S", "S"]
</script>

<PageHeader kanji="型" title="Kata" subtitle="Shape your days" />

<div class="weekday-header">
  <span class="habit-name-spacer"></span>
  {#each weekdays as day}
    <span class="weekday">{day}</span>
  {/each}
  <span class="streak-spacer"></span>
</div>

<div class="habits-stack">
  {#each habits as habit}
    <Card>
      <div class="habit-row">
        <span class="habit-name">{habit.name}</span>
        <div class="habit-pips">
          {#each habit.days as status}
            <HabitPip {status} />
          {/each}
        </div>
        <StatNumber value={habit.streak} label="days" size="sm" />
      </div>
    </Card>
  {/each}
</div>

<style>
  .weekday-header {
    display: flex;
    align-items: center;
    padding: 0 var(--space-6);
    margin-bottom: var(--space-2);
  }

  .habit-name-spacer {
    width: 100px;
    flex-shrink: 0;
  }

  .weekday {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    text-align: center;
    width: 8px;
    margin: 0 var(--space-2);
  }

  .streak-spacer {
    width: 60px;
    flex-shrink: 0;
  }

  .habits-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .habit-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .habit-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--ink);
    width: 100px;
    flex-shrink: 0;
  }

  .habit-pips {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex: 1;
  }
</style>
