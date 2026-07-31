<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"
  import { cardioTypeLabel } from "$lib/format"

  const CARDIO_TYPE_OPTIONS = [
    { value: "run", label: "Run" },
    { value: "cycle", label: "Cycle" },
    { value: "row", label: "Row" },
    { value: "swim", label: "Swim" },
    { value: "other", label: "Other" },
  ]

  const REGION_LABELS: Record<string, string> = {
    torso: "Torso",
    arms: "Arms",
    lower_body: "Lower Body",
  }
  const REGION_ORDER = ["torso", "arms", "lower_body"]

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  let plans = $state(page.data.plans ?? [])
  let inProgressLogs = $state(page.data.inProgressLogs ?? [])
  let recovery = $state(page.data.recovery ?? [])
  let stats = $state(page.data.stats ?? { thisWeekCount: 0, totalSessions: 0 })
  $effect(() => {
    plans = page.data.plans ?? []
    inProgressLogs = page.data.inProgressLogs ?? []
    recovery = page.data.recovery ?? []
    stats = page.data.stats ?? { thisWeekCount: 0, totalSessions: 0 }
  })

  let activeTab = $state<"recovery" | "recent">("recovery")

  // Recent Sessions data is only fetched once that tab is opened.
  let recentLogs = $state<any[] | null>(null)
  let recentLogsLoading = $state(false)

  async function loadRecentLogs() {
    if (recentLogs !== null || recentLogsLoading) return
    recentLogsLoading = true
    const res = await fetch("/api/dojo/logs?status=completed")
    if (res.ok) {
      const data = await res.json()
      recentLogs = data.slice(0, 10)
    }
    recentLogsLoading = false
  }

  function openRecentTab() {
    activeTab = "recent"
    loadRecentLogs()
  }

  // Cardio start picker state
  let cardioPickerOpen = $state(false)
  let cardioPickerPlanId = $state<string | null>(null)
  let cardioPickerSessionId = $state<string | null>(null)
  let cardioPickerType = $state<string>("run")

  const recoveryByRegion = $derived.by(() => {
    const out: Record<string, Array<{ muscle: string; region: string; totalFatigue: number }>> = {
      torso: [],
      arms: [],
      lower_body: [],
    }
    for (const entry of recovery) {
      if (out[entry.region]) out[entry.region].push(entry)
    }
    return out
  })

  const recoveryMax = $derived(
    recovery.reduce((m: number, r: any) => Math.max(m, r.totalFatigue ?? 0), 0),
  )

  function muscleLabel(muscle: string): string {
    return muscle?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? ""
  }

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  function duration(start: string, end: string | null): string {
    if (!end) return "In progress"
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.round(ms / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  async function startSession(planId: string, sessionId: string) {
    // For cardio plan sessions, prompt for cardio type before starting
    const plan = plans.find((p: any) => p.id === planId)
    const session = plan?.sessions?.find((s: any) => s.id === sessionId)
    if (session?.type === "cardio") {
      cardioPickerPlanId = planId
      cardioPickerSessionId = sessionId
      cardioPickerType = "run"
      cardioPickerOpen = true
      return
    }
    await createLog(planId, sessionId, null)
  }

  async function createLog(planId: string, sessionId: string, cardioType: string | null) {
    const body: Record<string, any> = { planId, sessionId }
    if (cardioType) body.cardioType = cardioType
    const res = await fetch("/api/dojo/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const log = await res.json()
      goto(`/dojo/session/${log.id}`)
    }
  }

  async function confirmCardioPicker() {
    if (!cardioPickerPlanId || !cardioPickerSessionId) return
    const planId = cardioPickerPlanId
    const sessionId = cardioPickerSessionId
    const type = cardioPickerType
    cardioPickerOpen = false
    cardioPickerPlanId = null
    cardioPickerSessionId = null
    await createLog(planId, sessionId, type)
  }

  function cancelCardioPicker() {
    cardioPickerOpen = false
    cardioPickerPlanId = null
    cardioPickerSessionId = null
  }

  let deletingLogId = $state<string | null>(null)

  async function handleDeleteLog(id: string) {
    await fetch(`/api/dojo/logs/${id}`, { method: "DELETE" })
    deletingLogId = null
    await invalidateAll()
    if (activeTab === "recent") {
      recentLogs = null
      await loadRecentLogs()
    }
  }
</script>

<PageHeader icon={icons.dojo} title="Dojo" subtitle="Forge your strength" />

<div class="stats-row">
  <StatNumber value={stats.thisWeekCount} label="this week" size="md" />
  <StatNumber value={stats.totalSessions} label="total sessions" size="md" />
</div>

<!-- In-progress Sessions -->
{#if inProgressLogs.length > 0}
  <section class="section">
    <h2 class="section-title">In Progress</h2>
    {#each inProgressLogs as log (log.id)}
      <Card>
        <div class="log-card">
          <div class="log-info">
            <strong class="log-session-name">{log.planSnapshot?.sessionName ?? "Workout"}</strong>
            <span class="log-plan-name">{log.planSnapshot?.planName ?? ""}</span>
            <span class="log-date">{formatDate(log.startedAt)} at {formatTime(log.startedAt)}</span>
          </div>
          <div class="log-actions">
            <Button variant="secondary" href="/dojo/session/{log.id}">Resume</Button>
            {#if deletingLogId === log.id}
              <div class="confirm-delete-inline">
                <span class="confirm-text">Delete?</span>
                <button class="confirm-btn yes" onclick={() => handleDeleteLog(log.id)}>Yes</button>
                <button class="confirm-btn no" onclick={() => (deletingLogId = null)}>No</button>
              </div>
            {:else}
              <button class="delete-btn-sm" onclick={() => (deletingLogId = log.id)}>Delete</button>
            {/if}
          </div>
        </div>
      </Card>
    {/each}
  </section>
{/if}

<!-- Quick Start -->
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Start Workout</h2>
    <a href="/dojo/plans" class="manage-plans-link">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      Manage Plans
    </a>
  </div>

  {#if plans.length > 0}
    {#each plans as plan (plan.id)}
      <Card>
        <div class="quick-start-plan">
          <span class="plan-name">{plan.name}</span>
          <div class="quick-start-sessions">
            {#each plan.sessions as session}
              <Button variant="secondary" onclick={() => startSession(plan.id, session.id)}>
                {session.name}
                {#if session.targetDayOfWeek !== null}
                  <span class="day-badge">{DAY_NAMES[session.targetDayOfWeek]}</span>
                {/if}
              </Button>
            {/each}
          </div>
        </div>
      </Card>
    {/each}
  {:else}
    <div class="empty-state">
      <p>Create a workout plan to get started.</p>
      <Button variant="primary" href="/dojo/plans">Create Plan</Button>
    </div>
  {/if}
</section>

<!-- Recovery / Recent Sessions Tabs -->
<section class="section">
  <div class="dojo-tabs" role="tablist">
    <button
      type="button"
      class="dojo-tab"
      class:active={activeTab === "recovery"}
      role="tab"
      aria-selected={activeTab === "recovery"}
      onclick={() => (activeTab = "recovery")}
    >
      Recovery
    </button>
    <button
      type="button"
      class="dojo-tab"
      class:active={activeTab === "recent"}
      role="tab"
      aria-selected={activeTab === "recent"}
      onclick={openRecentTab}
    >
      Recent Sessions
    </button>
  </div>

  {#if activeTab === "recent"}
    {#if recentLogsLoading}
      <div class="empty-state">
        <p>Loading...</p>
      </div>
    {:else if recentLogs && recentLogs.length > 0}
      {#each recentLogs as log (log.id)}
        <Card>
          <div class="completed-log-row">
            <a href="/dojo/session/{log.id}" class="log-card log-link completed-log-link">
              <div class="log-info">
                <strong class="log-session-name">{log.planSnapshot?.sessionName ?? "Workout"}</strong>
                <span class="log-plan-name">{log.planSnapshot?.planName ?? ""}</span>
              </div>
              <div class="log-meta">
                <span class="log-date">{formatDate(log.startedAt)}</span>
                <span class="log-duration">{duration(log.startedAt, log.completedAt)}</span>
                {#if log.planSnapshot?.sessionType === "cardio"}
                  <span class="log-sets">{cardioTypeLabel(log.cardioType)}</span>
                  {#if log.cardioDistance}
                    <span class="log-sets">{log.cardioDistance} mi</span>
                  {/if}
                  {#if log.caloriesBurned}
                    <span class="log-sets">{log.caloriesBurned} cal</span>
                  {/if}
                  {#if log.rpe != null}
                    <span class="log-sets">RPE {log.rpe}</span>
                  {/if}
                {:else}
                  <span class="log-sets">{log.sets.length} sets</span>
                  {#if log.performance?.totalVolume}
                    <span class="log-sets">{log.performance.totalVolume.toLocaleString()} lbs</span>
                  {/if}
                  {#if log.caloriesBurned}
                    <span class="log-sets">{log.caloriesBurned} cal</span>
                  {/if}
                  {#if log.performance?.exercisePerformance?.some((ep: any) => (ep.personalBests ?? []).length > 0)}
                    <span class="log-pr-badge">PR</span>
                  {/if}
                {/if}
              </div>
            </a>
            {#if deletingLogId === log.id}
              <div class="confirm-delete-inline">
                <span class="confirm-text">Delete?</span>
                <button class="confirm-btn yes" onclick={() => handleDeleteLog(log.id)}>Yes</button>
                <button class="confirm-btn no" onclick={() => (deletingLogId = null)}>No</button>
              </div>
            {:else}
              <button class="delete-btn-sm" onclick={() => (deletingLogId = log.id)}>Delete</button>
            {/if}
          </div>
        </Card>
      {/each}
    {:else}
      <div class="empty-state">
        <p>No completed sessions yet.</p>
      </div>
    {/if}
  {:else}
    <!-- Recovery tab -->
    {#if recoveryMax === 0}
      <div class="empty-state">
        <p>No muscle fatigue recorded in the last 5 days.</p>
      </div>
    {:else}
      <Card>
        <div class="recovery-panel">
          {#each REGION_ORDER as region}
            {#if recoveryByRegion[region].length > 0}
              <div class="recovery-region">
                <h3 class="recovery-region-title">{REGION_LABELS[region]}</h3>
                <div class="recovery-muscles">
                  {#each recoveryByRegion[region] as m}
                    <div class="recovery-row">
                      <span class="recovery-muscle">{muscleLabel(m.muscle)}</span>
                      <div class="recovery-bar-track">
                        <div
                          class="recovery-bar-fill"
                          style:width="{recoveryMax > 0 ? (m.totalFatigue / recoveryMax) * 100 : 0}%"
                        ></div>
                      </div>
                      <span class="recovery-value">{Math.round(m.totalFatigue)}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </Card>
    {/if}
  {/if}
</section>

<!-- Cardio Type Picker -->
{#if cardioPickerOpen}
  <div class="cardio-picker-overlay">
    <div class="cardio-picker-card">
      <h3 class="cardio-picker-title">What kind of cardio?</h3>
      <div class="cardio-picker-options">
        {#each CARDIO_TYPE_OPTIONS as opt}
          <button
            type="button"
            class="cardio-picker-option"
            class:selected={cardioPickerType === opt.value}
            onclick={() => (cardioPickerType = opt.value)}
          >
            {opt.label}
          </button>
        {/each}
      </div>
      <div class="cardio-picker-actions">
        <Button variant="secondary" onclick={cancelCardioPicker}>Cancel</Button>
        <Button variant="primary" onclick={confirmCardioPicker}>Start</Button>
      </div>
    </div>
  </div>
{/if}

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

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .section-header .section-title {
    margin-bottom: 0;
  }

  .manage-plans-link {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    background: none;
    border: none;
    padding: var(--space-2) 0;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .manage-plans-link:hover {
    color: var(--ink-light);
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

  .log-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .log-link {
    text-decoration: none;
    transition: opacity var(--transition-fast);
  }

  .log-link:hover {
    opacity: 0.8;
  }

  .completed-log-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .completed-log-link {
    flex: 1;
    min-width: 0;
  }

  .log-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .log-session-name {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .log-plan-name {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .log-date {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .log-pr-badge {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    background: var(--accent-green);
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .log-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .delete-btn-sm {
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--accent-red);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent-red);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn-sm:hover {
    background: var(--accent-red);
    color: white;
  }

  .confirm-delete-inline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
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
    border-color: var(--accent);
    color: var(--accent);
  }

  .confirm-btn.yes:hover {
    background: var(--accent);
    color: white;
  }

  .confirm-btn.no {
    color: var(--ink-light);
  }

  .confirm-btn.no:hover {
    border-color: var(--ink-light);
  }

  .log-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .log-duration {
    color: var(--ink-light);
  }

  .log-sets {
    color: var(--ink-light);
  }

  .quick-start-plan {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .plan-name {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .quick-start-sessions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .day-badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--paper-warm);
    color: var(--ink-light);
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

  .dojo-tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 0.5px solid var(--border);
    margin-bottom: var(--space-4);
  }

  .dojo-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    transition: all var(--transition-fast);
  }

  .dojo-tab:hover {
    color: var(--ink-light);
  }

  .dojo-tab.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  .recovery-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .recovery-region-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-light);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin: 0 0 var(--space-2);
  }

  .recovery-muscles {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .recovery-row {
    display: grid;
    grid-template-columns: 110px 1fr 48px;
    align-items: center;
    gap: var(--space-3);
  }

  .recovery-muscle {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .recovery-bar-track {
    height: 8px;
    background: var(--border);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .recovery-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-pill);
    transition: width var(--transition-fast);
  }

  .recovery-value {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    text-align: right;
  }

  .cardio-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-4);
  }

  .cardio-picker-card {
    background: var(--surface);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .cardio-picker-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
    text-align: center;
  }

  .cardio-picker-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }

  .cardio-picker-option {
    padding: var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .cardio-picker-option:hover {
    border-color: var(--ink-light);
  }

  .cardio-picker-option.selected {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .cardio-picker-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
