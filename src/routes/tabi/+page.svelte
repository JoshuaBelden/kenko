<script lang="ts">
  import { Card, PageHeader, ProgressBar, StatNumber } from "$lib/components"

  const calendarDays = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2
    if (day < 1 || day > 30) return null
    return day
  })

  const highlightedDays = new Set([1, 3, 5, 7, 10, 12, 14, 15, 18, 20, 22, 25, 28])
  const today = 1
</script>

<PageHeader kanji="旅" title="Tabi" subtitle="Every journey begins with a single step" />

<section class="section">
  <h3>Active Journey</h3>
  <Card>
    <div class="journey-header">
      <div>
        <h4 class="journey-title">Run a Marathon</h4>
        <p class="journey-dates">Started Jan 15 &middot; Target Jun 30</p>
      </div>
      <StatNumber value="42%" label="complete" size="sm" />
    </div>
    <div class="journey-progress">
      <ProgressBar value={42} />
    </div>
    <div class="milestones">
      <div class="milestone done">
        <span class="milestone-check">&#10003;</span>
        <span>Run 5K without stopping</span>
      </div>
      <div class="milestone done">
        <span class="milestone-check">&#10003;</span>
        <span>Complete 10K race</span>
      </div>
      <div class="milestone current">
        <span class="milestone-dot"></span>
        <span>Run half marathon</span>
      </div>
      <div class="milestone pending">
        <span class="milestone-dot"></span>
        <span>Complete full marathon</span>
      </div>
    </div>
  </Card>
</section>

<section class="section">
  <h3>Journal</h3>
  <div class="journal-stack">
    <Card>
      <span class="journal-date">March 31, 2026</span>
      <p class="journal-text">
        Long run today — 18km along the river path. Legs felt heavy in the first half but found a rhythm after the
        bridge. Need to focus on hydration the night before.
      </p>
    </Card>
    <Card>
      <span class="journal-date">March 28, 2026</span>
      <p class="journal-text">
        Rest day. Foam rolled and stretched for 30 minutes. Watched a documentary on Eliud Kipchoge — his discipline is
        inspiring. Small daily improvements.
      </p>
    </Card>
    <Card>
      <span class="journal-date">March 25, 2026</span>
      <p class="journal-text">
        Interval training at the track. 8x400m with 90s recovery. Averaged 1:42 per rep. Feeling stronger than last
        month.
      </p>
    </Card>
  </div>
</section>

<section class="section">
  <h3>April 2026</h3>
  <Card>
    <div class="calendar">
      <div class="calendar-header">
        {#each ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as day}
          <span class="calendar-weekday">{day}</span>
        {/each}
      </div>
      <div class="calendar-grid">
        {#each calendarDays as day}
          {#if day === null}
            <span class="calendar-day empty"></span>
          {:else}
            <span class="calendar-day" class:highlighted={highlightedDays.has(day)} class:today={day === today}>
              {day}
            </span>
          {/if}
        {/each}
      </div>
    </div>
  </Card>
</section>

<style>
  .section {
    margin-bottom: var(--space-8);
  }

  .section h3 {
    margin-bottom: var(--space-4);
  }

  .journey-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-4);
  }

  .journey-title {
    font-size: var(--text-xl);
  }

  .journey-dates {
    font-size: var(--text-sm);
    margin-top: var(--space-1);
  }

  .journey-progress {
    margin-bottom: var(--space-6);
  }

  .milestones {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .milestone {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .milestone.done {
    color: var(--accent-green);
  }

  .milestone.current span:last-child {
    color: var(--ink);
    font-weight: 500;
  }

  .milestone.pending {
    color: var(--ink-faint);
  }

  .milestone-check {
    font-size: var(--text-sm);
    width: 20px;
    text-align: center;
  }

  .milestone-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ink-faint);
    margin: 0 6px;
  }

  .milestone.current .milestone-dot {
    background: var(--accent);
  }

  .journal-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .journal-date {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
    display: block;
    margin-bottom: var(--space-2);
  }

  .journal-text {
    font-size: var(--text-sm);
    line-height: 1.7;
  }

  .calendar-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: var(--space-2);
  }

  .calendar-weekday {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
    text-align: center;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--space-1);
  }

  .calendar-day {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-align: center;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
  }

  .calendar-day.empty {
    visibility: hidden;
  }

  .calendar-day.highlighted {
    color: var(--accent-green);
    background: var(--accent-green-soft);
  }

  .calendar-day.today {
    color: #ffffff;
    background: var(--accent);
    font-weight: 500;
  }
</style>
