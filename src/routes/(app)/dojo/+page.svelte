<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"

  let plans = $state(page.data.plans ?? [])
  let logs = $state(page.data.logs ?? [])
  $effect(() => {
    plans = page.data.plans ?? []
    logs = page.data.logs ?? []
  })

  const inProgressLogs = $derived(logs.filter((l: any) => l.status === "in_progress"))
  const completedLogs = $derived(logs.filter((l: any) => l.status === "completed"))

  const thisWeekCount = $derived(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    return completedLogs.filter((l: any) => new Date(l.completedAt) >= startOfWeek).length
  })

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
    const res = await fetch("/api/dojo/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, sessionId }),
    })
    if (res.ok) {
      const log = await res.json()
      goto(`/dojo/session/${log.id}`)
    }
  }

  let deletingLogId = $state<string | null>(null)

  async function handleDeleteLog(id: string) {
    await fetch(`/api/dojo/logs/${id}`, { method: "DELETE" })
    deletingLogId = null
    await invalidateAll()
  }
</script>

<PageHeader icon={icons.dojo} title="Dojo" subtitle="Forge your strength" />

<div class="stats-row">
  <StatNumber value={thisWeekCount()} label="this week" size="md" />
  <StatNumber value={completedLogs.length} label="total sessions" size="md" />
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
{#if plans.length > 0}
  <section class="section">
    <h2 class="section-title">Start Workout</h2>
    {#each plans as plan (plan.id)}
      <Card>
        <div class="quick-start-plan">
          <span class="plan-name">{plan.name}</span>
          <div class="quick-start-sessions">
            {#each plan.sessions as session}
              <Button variant="secondary" onclick={() => startSession(plan.id, session.id)}>
                {session.name}
              </Button>
            {/each}
          </div>
        </div>
      </Card>
    {/each}
  </section>
{:else}
  <section class="section">
    <div class="empty-state">
      <p>Create a workout plan to get started.</p>
      <Button variant="primary" href="/dojo/plans">Create Plan</Button>
    </div>
  </section>
{/if}

<!-- Recent Completed -->
{#if completedLogs.length > 0}
  <section class="section">
    <h2 class="section-title">Recent Sessions</h2>
    {#each completedLogs.slice(0, 10) as log (log.id)}
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
                <span class="log-sets">Cardio</span>
              {:else}
                <span class="log-sets">{log.sets.length} sets</span>
              {/if}
              {#if log.cardioDistance}
                <span class="log-sets">{log.cardioDistance} mi</span>
              {/if}
              {#if log.caloriesBurned}
                <span class="log-sets">{log.caloriesBurned} cal</span>
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
  </section>
{/if}

<div class="nav-links">
  <Button variant="ghost" href="/dojo/plans">Manage Plans</Button>
</div>

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

  .log-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .delete-btn-sm {
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--accent);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn-sm:hover {
    background: var(--accent);
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
</style>
