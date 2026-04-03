<script lang="ts">
  import { invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"

  const commitment = $derived(page.data.commitment)
  const progress = $derived(page.data.progress)
  const history = $derived(page.data.history ?? [])
  const journeyTotal = $derived(page.data.journeyTotal)
  const allTimeTotal = $derived(page.data.allTimeTotal ?? 0)
  const taperProgress = $derived(page.data.taperProgress)
  const taperHistory = $derived(page.data.taperHistory ?? [])

  let confirmingComplete = $state(false)

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

  async function markTaperComplete() {
    if (!commitment) return
    await fetch(`/api/kata/commitments/${commitment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    })
    confirmingComplete = false
    await invalidateAll()
  }
</script>

{#if !commitment}
  <PageHeader icon={icons.kata} title="Not Found" />
  <div class="empty-state">
    <p>This commitment doesn't exist.</p>
    <Button variant="primary" href="/kata">Back to Kata</Button>
  </div>
{:else if commitment.type === "taper"}
  <!-- TAPER DETAIL VIEW -->
  <PageHeader icon={icons.kata} title={commitment.name} subtitle={commitment.unit} />

  <!-- Taper Summary -->
  <div class="stats-row">
    {#if taperProgress?.status === "scheduled"}
      <StatNumber value={taperProgress.daysUntilStart ?? 0} label="days until start" size="lg" />
    {:else if taperProgress?.status === "active" && taperProgress.currentPhase}
      <StatNumber value={taperProgress.todayValue} label="today" size="lg" />
      <StatNumber value={taperProgress.todayLimit ?? 0} label="limit" size="md" />
    {:else if taperProgress?.status === "completed"}
      <StatNumber value={taperProgress.overallProgress.totalWeeks} label="weeks completed" size="lg" />
    {/if}
    <StatNumber value={allTimeTotal} label="all time" size="md" />
  </div>

  <!-- Current phase progress -->
  {#if taperProgress?.status === "active" && taperProgress.currentPhase}
    <Card>
      <div class="progress-section">
        <div class="progress-meta">
          <span class="meta-label">{taperProgress.currentPhase.label}</span>
          <span class="meta-value">
            {taperProgress.todayValue} / {taperProgress.todayLimit} {commitment.unit}
          </span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            style:width="{taperProgress.todayLimit ? Math.min((taperProgress.todayValue / taperProgress.todayLimit) * 100, 100) : 100}%"
            style:background={taperProgress.todayValue <= (taperProgress.todayLimit ?? 0) ? "var(--accent-green)" : "#c49a3a"}
          ></div>
        </div>
        <div class="taper-detail-meta">
          <span class="meta-label">Week {taperProgress.overallProgress.currentWeek} of {taperProgress.overallProgress.totalWeeks}</span>
          {#if taperProgress.nextPhase}
            <span class="meta-value taper-next-hint">In {taperProgress.nextPhase.daysUntilStart}d: {taperProgress.nextPhase.label} &middot; {taperProgress.nextPhase.dailyLimit}/day</span>
          {/if}
        </div>
      </div>
    </Card>
  {/if}

  <!-- Phase Timeline -->
  <section class="section">
    <h2 class="section-title">Phase Schedule</h2>
    <Card>
      <div class="taper-timeline">
        {#each taperProgress?.phaseSchedule ?? [] as phase}
          <div class="timeline-phase" class:timeline-active={phase.status === "active"} class:timeline-past={phase.status === "past"} class:timeline-upcoming={phase.status === "upcoming"}>
            <div class="timeline-indicator">
              <div class="timeline-dot"></div>
              <div class="timeline-line"></div>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong class="timeline-label">{phase.label}</strong>
                <span class="timeline-limit">{phase.dailyLimit} {commitment.unit}/day</span>
              </div>
              {#if phase.status === "active"}
                <span class="timeline-badge">Active</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </Card>
  </section>

  <!-- History — 30-day grid -->
  <section class="section">
    <h2 class="section-title">History</h2>
    {#if taperHistory.length > 0}
      <Card>
        <div class="day-grid">
          {#each taperHistory as day}
            <div
              class="day-cell"
              class:met={day.value > 0 && day.met}
              class:not-met={day.value > 0 && !day.met}
              class:empty={day.value === 0}
              title="{day.date}: {day.value} / {day.dailyLimit} {commitment.unit}"
            >
              <span class="day-num">{dayOfMonth(day.date)}</span>
            </div>
          {/each}
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
    <Button variant="ghost" href="/kata">Close</Button>
    <div class="actions-right">
      {#if taperProgress?.status !== "completed"}
        {#if confirmingComplete}
          <div class="confirm-complete-inline">
            <span class="confirm-text">Mark complete?</span>
            <button type="button" class="confirm-btn yes" onclick={markTaperComplete}>Yes</button>
            <button type="button" class="confirm-btn no" onclick={() => (confirmingComplete = false)}>No</button>
          </div>
        {:else}
          <button type="button" class="complete-btn" onclick={() => (confirmingComplete = true)}>Mark Complete</button>
        {/if}
      {/if}
      <Button variant="secondary" href="/kata/{commitment.id}/edit">Edit</Button>
    </div>
  </div>

{:else}
  <!-- STANDARD DETAIL VIEW -->
  <PageHeader icon={icons.kata} title={commitment.name} subtitle={periodLabel(commitment.period)} />

  <!-- Summary -->
  <div class="stats-row">
    <StatNumber value={progress?.current ?? 0} label={periodLabel(commitment.period)} size="lg" />
    {#if commitment.loggingStyle !== "checkbox"}
      <StatNumber value={commitment.targetValue} label="target" size="md" />
    {/if}
    <StatNumber value={allTimeTotal} label="all time" size="md" />
  </div>

  <!-- Current period progress -->
  {#if commitment.loggingStyle !== "checkbox"}
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
  {/if}

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
    <Button variant="ghost" href="/kata">Close</Button>
    <Button variant="secondary" href="/kata/{commitment.id}/edit">Edit</Button>
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

  /* Taper detail styles */
  .taper-detail-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: var(--space-1);
  }

  .taper-next-hint {
    font-style: italic;
    color: var(--ink-faint) !important;
    font-size: var(--text-xs) !important;
  }

  /* Phase timeline */
  .taper-timeline {
    display: flex;
    flex-direction: column;
  }

  .timeline-phase {
    display: flex;
    gap: var(--space-3);
    min-height: 44px;
  }

  .timeline-phase:last-child .timeline-line {
    display: none;
  }

  .timeline-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    flex-shrink: 0;
  }

  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    flex-shrink: 0;
    margin-top: 6px;
  }

  .timeline-phase.timeline-active .timeline-dot {
    background: var(--accent-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-green) 25%, transparent);
  }

  .timeline-phase.timeline-past .timeline-dot {
    background: var(--ink-faint);
  }

  .timeline-line {
    width: 1px;
    flex: 1;
    background: var(--border);
    margin: 4px 0;
  }

  .timeline-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: var(--space-2);
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .timeline-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .timeline-phase.timeline-upcoming .timeline-label {
    color: var(--ink-faint);
  }

  .timeline-limit {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .timeline-badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--accent-green);
    font-weight: 500;
  }

  /* Mark complete */
  .actions-right {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .complete-btn {
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--accent-green);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent-green);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .complete-btn:hover {
    background: var(--accent-green);
    color: white;
  }

  .confirm-complete-inline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .confirm-btn {
    padding: var(--space-1) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .confirm-btn.yes {
    border-color: var(--accent-green);
    color: var(--accent-green);
  }

  .confirm-btn.yes:hover {
    background: var(--accent-green);
    color: white;
  }

  .confirm-btn.no {
    color: var(--ink-light);
  }

  .confirm-btn.no:hover {
    border-color: var(--ink-light);
  }
</style>
