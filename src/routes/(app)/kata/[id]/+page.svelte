<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"

  const commitment = $derived(page.data.commitment)
  const progress = $derived(page.data.progress)
  const history = $derived(page.data.history ?? [])
  const journeyTotal = $derived(page.data.journeyTotal)
  const allTimeTotal = $derived(page.data.allTimeTotal ?? 0)

  let confirmDelete = $state(false)
  let deleting = $state(false)

  function periodLabel(period: string): string {
    switch (period) {
      case "daily": return "Today"
      case "weekly": return "This Week"
      case "monthly": return "This Month"
      case "journey_total": return "Journey Total"
      default: return period
    }
  }

  function directionLabel(dir: string): string {
    return dir === "achieve" ? "Achieve" : "Limit"
  }

  function progressColor(): string {
    if (!commitment || !progress) return "var(--accent-green)"
    if (commitment.direction === "achieve") return "var(--accent-green)"
    if (progress.percentage > 100) return "var(--accent)"
    if (progress.percentage >= 80) return "#c49a3a"
    return "var(--accent-green)"
  }

  function isMet(value: number, target: number, direction: string): boolean {
    return direction === "achieve" ? value >= target : value <= target
  }

  function dayOfWeek(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z")
    return d.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })
  }

  function dayOfMonth(dateStr: string): string {
    return dateStr.slice(8, 10).replace(/^0/, "")
  }

  function formatWeekLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  }

  function formatMonthLabel(dateStr: string): string {
    const [year, month] = dateStr.split("-")
    const d = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1))
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
  }

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  async function handleDelete() {
    if (!confirmDelete) {
      confirmDelete = true
      return
    }
    deleting = true
    await fetch(`/api/kata/commitments/${commitment.id}`, { method: "DELETE" })
    goto("/kata")
  }
</script>

{#if !commitment}
  <PageHeader kanji="型" title="Not Found" />
  <div class="empty-state">
    <p>This commitment doesn't exist.</p>
    <Button variant="primary" href="/kata">Back to Kata</Button>
  </div>
{:else}
  <PageHeader kanji="型" title={commitment.name} subtitle={periodLabel(commitment.period)} />

  <!-- Summary -->
  <div class="stats-row">
    <StatNumber value={progress?.current ?? 0} label={periodLabel(commitment.period)} size="lg" />
    <StatNumber value={commitment.targetValue} label="target" size="md" />
    <StatNumber value={allTimeTotal} label="all time" size="md" />
  </div>

  <!-- Current period progress -->
  <Card>
    <div class="progress-section">
      <div class="progress-meta">
        <span class="meta-label">{directionLabel(commitment.direction)}</span>
        <span class="meta-value">
          {progress?.current ?? 0}{commitment.unit ? ` ${commitment.unit}` : ""} / {commitment.targetValue}{commitment.unit ? ` ${commitment.unit}` : ""}
        </span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          style:width="{Math.min(progress?.percentage ?? 0, 100)}%"
          style:background={progressColor()}
        ></div>
      </div>
    </div>
  </Card>

  <!-- Details -->
  {#if commitment.description || commitment.journeyName}
    <section class="section">
      <h2 class="section-title">Details</h2>
      <Card>
        <div class="details">
          {#if commitment.description}
            <p class="description">{commitment.description}</p>
          {/if}
          <div class="detail-row">
            <span class="detail-label">Logging</span>
            <span class="detail-value">{commitment.loggingStyle === "checkbox" ? "Checkbox" : "Quantity"}{commitment.unit ? ` (${commitment.unit})` : ""}</span>
          </div>
          {#if commitment.journeyName}
            <div class="detail-row">
              <span class="detail-label">Journey</span>
              <span class="detail-value">{commitment.journeyName}</span>
            </div>
          {:else}
            <div class="detail-row">
              <span class="detail-label">Scope</span>
              <span class="detail-value">Evergreen</span>
            </div>
          {/if}
        </div>
      </Card>
    </section>
  {/if}

  <!-- Period History -->
  <section class="section">
    <h2 class="section-title">History</h2>

    {#if commitment.period === "daily" && history.length > 0}
      <!-- 30-day calendar grid -->
      <Card>
        <div class="day-grid">
          {#each history as day}
            <div
              class="day-cell"
              class:met={day.value > 0 && isMet(day.value, day.target, commitment.direction)}
              class:not-met={day.value > 0 && !isMet(day.value, day.target, commitment.direction)}
              class:empty={day.value === 0}
              title="{day.label}: {day.value}{commitment.unit ? ` ${commitment.unit}` : ""}"
            >
              <span class="day-num">{dayOfMonth(day.label)}</span>
            </div>
          {/each}
        </div>
      </Card>

    {:else if commitment.period === "weekly" && history.length > 0}
      <!-- 8 week cards -->
      <div class="week-grid">
        {#each history as week}
          <Card>
            <div class="week-card" class:met={week.met} class:not-met={!week.met && week.value > 0}>
              <span class="week-label">{formatWeekLabel(week.label)}</span>
              <strong class="week-value">{week.value}{commitment.unit ? ` ${commitment.unit}` : ""}</strong>
              <span class="week-target">/ {week.target}</span>
            </div>
          </Card>
        {/each}
      </div>

    {:else if commitment.period === "monthly" && history.length > 0}
      <!-- 12 month cards -->
      <div class="month-grid">
        {#each history as month}
          <Card>
            <div class="month-card" class:met={month.met} class:not-met={!month.met && month.value > 0}>
              <span class="month-label">{formatMonthLabel(month.label)}</span>
              <strong class="month-value">{month.value}</strong>
              <span class="month-target">/ {month.target}</span>
            </div>
          </Card>
        {/each}
      </div>

    {:else if commitment.period === "journey_total" && journeyTotal}
      <!-- Running cumulative total + log list -->
      <Card>
        <div class="journey-total-section">
          <div class="journey-cumulative">
            <StatNumber value={journeyTotal.cumulativeTotal} label="cumulative total" size="lg" />
          </div>
          {#if journeyTotal.entries.length > 0}
            <div class="log-list">
              {#each journeyTotal.entries as entry}
                <div class="log-entry">
                  <span class="log-date">{formatDate(entry.date)}</span>
                  <span class="log-value">+{entry.value}{commitment.unit ? ` ${commitment.unit}` : ""}</span>
                  <span class="log-cumulative">{entry.cumulativeAtDate}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </Card>

    {:else}
      <Card>
        <p class="no-history">No history yet. Start logging to see your progress over time.</p>
      </Card>
    {/if}
  </section>

  <!-- Actions -->
  <div class="actions">
    <Button variant="secondary" href="/kata/{commitment.id}/edit">Edit</Button>
    <button
      class="delete-btn"
      class:confirming={confirmDelete}
      onclick={handleDelete}
      disabled={deleting}
    >
      {#if deleting}
        Deleting...
      {:else if confirmDelete}
        Confirm Delete
      {:else}
        Delete
      {/if}
    </button>
  </div>

  <div class="back-link">
    <Button variant="ghost" href="/kata">Back to Kata</Button>
  </div>
{/if}

<style>
  .stats-row {
    display: flex;
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .section {
    margin-top: var(--space-6);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-light);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: var(--space-3);
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .meta-value {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .progress-track {
    height: 4px;
    background: var(--paper-warm);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width var(--transition-base);
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .description {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    line-height: 1.5;
    margin: 0;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .detail-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .detail-value {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
  }

  /* Daily grid */
  .day-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: var(--paper-warm);
    transition: background var(--transition-fast);
  }

  .day-cell.met {
    background: var(--accent-green);
  }

  .day-cell.not-met {
    background: var(--accent);
  }

  .day-cell.empty {
    background: var(--paper-warm);
  }

  .day-num {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .day-cell.met .day-num,
  .day-cell.not-met .day-num {
    color: white;
  }

  /* Weekly grid */
  .week-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .week-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-1) 0;
  }

  .week-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .week-value {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--ink);
  }

  .week-card.met .week-value {
    color: var(--accent-green);
  }

  .week-card.not-met .week-value {
    color: var(--accent);
  }

  .week-target {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  /* Monthly grid */
  .month-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .month-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-1) 0;
  }

  .month-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .month-value {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--ink);
  }

  .month-card.met .month-value {
    color: var(--accent-green);
  }

  .month-card.not-met .month-value {
    color: var(--accent);
  }

  .month-target {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  /* Journey total */
  .journey-total-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .journey-cumulative {
    text-align: center;
    padding: var(--space-2) 0;
  }

  .log-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: 0.5px solid var(--border);
    padding-top: var(--space-3);
  }

  .log-entry {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  .log-date {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    width: 100px;
  }

  .log-value {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-green);
  }

  .log-cumulative {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin-left: auto;
  }

  .no-history {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    text-align: center;
    padding: var(--space-4);
    margin: 0;
  }

  /* Actions */
  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-6);
    gap: var(--space-3);
  }

  .delete-btn {
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-pill);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .delete-btn.confirming {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .back-link {
    text-align: center;
    margin-top: var(--space-4);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-6);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
</style>
