<script lang="ts">
  import { invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"

  const commitments = $derived(page.data.commitments ?? [])

  // Inline logging state
  let loggingId = $state<string | null>(null)
  let loggingValue = $state("")

  const totalActive = $derived(commitments.length)
  const metToday = $derived(
    commitments.filter((c: any) => {
      if (c.type === "taper") {
        if (!c.taperProgress || c.taperProgress.status !== "active") return false
        return c.taperProgress.todayValue <= (c.taperProgress.todayLimit ?? 0)
      }
      if (!c.todayLog) return false
      if (c.direction === "achieve") return c.progress.current >= c.progress.target
      return c.progress.current <= c.progress.target
    }).length,
  )

  function progressColor(c: any): string {
    if (c.direction === "achieve") return "var(--accent-green)"
    // Limit: amber as approaching, red if exceeded
    if (c.progress.percentage > 100) return "var(--accent)"
    if (c.progress.percentage >= 80) return "#c49a3a"
    return "var(--accent-green)"
  }

  function taperProgressColor(c: any): string {
    if (!c.taperProgress?.currentPhase) return "var(--ink-faint)"
    return c.taperProgress.todayValue <= c.taperProgress.todayLimit
      ? "var(--accent-green)"
      : "#c49a3a"
  }

  async function toggleCheckbox(c: any) {
    const current = c.todayLog?.value ?? 0
    const next = current > 0 ? 0 : c.progress.target
    await fetch(`/api/kata/commitments/${c.id}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: next }),
    })
    await invalidateAll()
  }

  function startQuantityLog(c: any) {
    loggingId = c.id
    loggingValue = c.todayLog ? String(c.todayLog.value) : ""
  }

  async function submitQuantityLog(commitmentId: string) {
    const val = parseFloat(loggingValue)
    if (isNaN(val) || val < 0) return

    await fetch(`/api/kata/commitments/${commitmentId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: val }),
    })
    loggingId = null
    loggingValue = ""
    await invalidateAll()
  }

  function cancelLog() {
    loggingId = null
    loggingValue = ""
  }

  function formatProgress(c: any): string {
    if (c.loggingStyle === "checkbox") return ""
    const current = c.progress.current
    const target = c.progress.target
    const unit = c.unit ? ` ${c.unit}` : ""
    return `${current}${unit} / ${target}${unit}`
  }

  function periodLabel(period: string): string {
    switch (period) {
      case "daily": return "today"
      case "weekly": return "this week"
      case "monthly": return "this month"
      case "journey_total": return "total"
      default: return period
    }
  }
</script>

<PageHeader icon={icons.kata} title="Kata" subtitle="Shape your habits" />

<div class="stats-row">
  <StatNumber value={metToday} label="met today" size="md" />
  <StatNumber value={totalActive} label="commitments" size="md" />
</div>

{#if commitments.length === 0}
  <section class="section">
    <div class="empty-state">
      <p>No commitments yet. Define your first kata to start building habits.</p>
      <Button variant="primary" href="/kata/new">New Commitment</Button>
    </div>
  </section>
{:else}
  <section class="section">
    {#each commitments as c (c.id)}
      {@render commitmentCard(c)}
    {/each}
  </section>

  <div class="nav-links">
    <Button variant="primary" href="/kata/new">New Commitment</Button>
  </div>
{/if}

{#snippet commitmentCard(c: any)}
  <Card>
    {#if c.type === "taper"}
      {@render taperCard(c)}
    {:else}
      <div class="commitment-card">
        <a href="/kata/{c.id}" class="commitment-info">
          <div class="commitment-header">
            <strong class="commitment-name">{c.name}</strong>
            <span class="commitment-period">{periodLabel(c.period)}</span>
          </div>
          {#if c.description}
            <span class="commitment-description">{c.description}</span>
          {/if}
          {#if c.loggingStyle !== "checkbox"}
            <div class="commitment-progress">
              <div class="progress-bar-wrapper">
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style:width="{Math.min(c.progress.percentage, 100)}%"
                    style:background={progressColor(c)}
                  ></div>
                </div>
              </div>
              <span class="progress-text">{formatProgress(c)}</span>
            </div>
          {/if}
        </a>
        <div class="commitment-action">
          {#if c.loggingStyle === "checkbox"}
            <button
              class="checkbox-btn"
              class:checked={c.todayLog && c.todayLog.value > 0}
              onclick={() => toggleCheckbox(c)}
              aria-label={c.todayLog && c.todayLog.value > 0 ? "Unmark done" : "Mark done"}
            >
              {#if c.todayLog && c.todayLog.value > 0}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              {:else}
                <div class="checkbox-empty"></div>
              {/if}
            </button>
          {:else if loggingId === c.id}
            <div class="quantity-input-row">
              <input
                type="number"
                class="quantity-input"
                bind:value={loggingValue}
                placeholder="0"
                min="0"
                step="any"
                onkeydown={(e) => { if (e.key === "Enter") submitQuantityLog(c.id); if (e.key === "Escape") cancelLog() }}
              />
              {#if c.unit}<span class="quantity-unit">{c.unit}</span>{/if}
              <button class="quantity-confirm" onclick={() => submitQuantityLog(c.id)} aria-label="Confirm log">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button class="quantity-cancel" onclick={cancelLog} aria-label="Cancel log">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {:else}
            <button class="log-btn" onclick={() => startQuantityLog(c)}>
              {#if c.todayLog}
                <span class="logged-value">{c.todayLog.value}</span>
              {:else}
                Log
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </Card>
{/snippet}

{#snippet taperCard(c: any)}
  {@const tp = c.taperProgress}
  <div class="commitment-card">
    <a href="/kata/{c.id}" class="commitment-info">
      <div class="commitment-header">
        <strong class="commitment-name">{c.name}</strong>
        <span class="commitment-period">{c.unit}</span>
      </div>
      {#if c.description}
        <span class="commitment-description">{c.description}</span>
      {/if}
      {#if tp?.status === "scheduled"}
        <span class="taper-status-text">Starts in {tp.daysUntilStart} day{tp.daysUntilStart === 1 ? "" : "s"}</span>
      {:else if tp?.status === "completed"}
        <span class="taper-status-text taper-completed">Completed &middot; {tp.overallProgress.totalWeeks} weeks</span>
      {:else if tp?.status === "active" && tp.currentPhase}
        <div class="taper-active-info">
          <span class="taper-phase-label">{tp.currentPhase.label} &middot; Limit: {tp.currentPhase.dailyLimit} {c.unit}/day</span>
          <div class="taper-today-row">
            <span class="taper-today-value" style:color={taperProgressColor(c)}>{tp.todayValue}</span>
            <span class="taper-today-sep">/</span>
            <span class="taper-today-limit">{tp.todayLimit}</span>
            <span class="taper-week-progress">Week {tp.overallProgress.currentWeek} of {tp.overallProgress.totalWeeks}</span>
          </div>
          {#if tp.nextPhase}
            <span class="taper-next-preview">In {tp.nextPhase.daysUntilStart}d: {tp.nextPhase.label} &middot; {tp.nextPhase.dailyLimit}/day</span>
          {/if}
        </div>
      {:else if tp?.status === "beyond_phases"}
        <span class="taper-status-text taper-greyed">Past all phases</span>
      {/if}
    </a>
    <div class="commitment-action">
      {#if tp?.status === "active" || tp?.status === "beyond_phases"}
        {#if loggingId === c.id}
          <div class="quantity-input-row">
            <input
              type="number"
              class="quantity-input"
              bind:value={loggingValue}
              placeholder="0"
              min="0"
              step="any"
              onkeydown={(e) => { if (e.key === "Enter") submitQuantityLog(c.id); if (e.key === "Escape") cancelLog() }}
            />
            {#if c.unit}<span class="quantity-unit">{c.unit}</span>{/if}
            <button class="quantity-confirm" onclick={() => submitQuantityLog(c.id)} aria-label="Confirm log">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button class="quantity-cancel" onclick={cancelLog} aria-label="Cancel log">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        {:else}
          <button class="log-btn" onclick={() => startQuantityLog(c)}>
            {#if c.todayLog}
              <span class="logged-value">{c.todayLog.value}</span>
            {:else}
              Log
            {/if}
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

<style>
  .stats-row {
    display: flex;
    gap: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .section {
    margin-bottom: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  .commitment-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .commitment-info {
    flex: 1;
    min-width: 0;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .commitment-info:hover {
    opacity: 0.8;
    transition: opacity var(--transition-fast);
  }

  .commitment-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .commitment-name {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .commitment-period {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .commitment-description {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
  }

  .commitment-progress {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .progress-bar-wrapper {
    flex: 1;
  }

  .progress-track {
    height: 2px;
    background: var(--paper-warm);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width var(--transition-base);
  }

  .progress-text {
    font-family: var(--font-display);
    font-size: var(--text-xs);
    color: var(--ink-light);
    white-space: nowrap;
  }

  .commitment-action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .checkbox-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-faint);
    transition: color var(--transition-fast);
  }

  .checkbox-btn.checked {
    color: var(--accent-green);
  }

  .checkbox-btn:hover {
    color: var(--ink);
  }

  .checkbox-empty {
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--ink-faint);
    border-radius: 4px;
  }

  .log-btn {
    padding: var(--space-1) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .log-btn:hover {
    border-color: var(--ink-light);
    color: var(--ink);
  }

  .logged-value {
    color: var(--accent-green);
    font-weight: 500;
  }

  .quantity-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .quantity-input {
    width: 60px;
    padding: var(--space-1);
    border: none;
    border-bottom: 1px solid var(--border);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    text-align: center;
    outline: none;
  }

  .quantity-input:focus {
    border-color: var(--accent-green);
  }

  .quantity-unit {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .quantity-confirm,
  .quantity-cancel {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .quantity-confirm {
    color: var(--accent-green);
  }

  .quantity-cancel {
    color: var(--ink-faint);
  }

  .quantity-confirm:hover {
    color: var(--ink);
  }

  .quantity-cancel:hover {
    color: var(--accent);
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

  .nav-links {
    text-align: center;
    margin-top: var(--space-4);
  }

  /* Taper card styles */
  .taper-status-text {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .taper-completed {
    color: var(--accent-green);
  }

  .taper-greyed {
    color: var(--ink-faint);
  }

  .taper-active-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .taper-phase-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
  }

  .taper-today-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  .taper-today-value {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
  }

  .taper-today-sep {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .taper-today-limit {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  .taper-week-progress {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    margin-left: var(--space-2);
  }

  .taper-next-preview {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-style: italic;
  }
</style>
