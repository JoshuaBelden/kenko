<script lang="ts">
  import { page } from "$app/state"
  import { Card, PageHeader, ProgressBar } from "$lib/components"
  import { icons } from "$lib/icons"
  import { journeyLens } from "$lib/stores/journeyLens.svelte"

  const data = $derived(page.data as any)
  const journeys = $derived((data.dashboardJourneys ?? []) as any[])
  const snapshots = $derived((data.snapshots ?? {}) as Record<string, any>)

  // Auto-select single journey
  $effect(() => {
    if (journeys.length === 1 && journeyLens.isGlobalView) {
      journeyLens.select(journeys[0].id)
    }
  })

  const selectedJourney = $derived(
    journeyLens.selectedId ? journeys.find((j: any) => j.id === journeyLens.selectedId) : null,
  )

  const snapshot = $derived(
    journeyLens.selectedId ? snapshots[journeyLens.selectedId] ?? null : null,
  )

  const hasModules = $derived(
    snapshot && (snapshot.shoku || snapshot.danjiki || snapshot.dojo || snapshot.kata),
  )

  function pct(current: number, target: number): number {
    if (!target) return 0
    return Math.min(100, Math.round((current / target) * 100))
  }
</script>

<PageHeader icon={icons.dashboard} title="Dashboard" subtitle="Your wellness at a glance" />

<!-- Journey toggle -->
{#if journeys.length === 0}
  <Card>
    <div class="empty-prompt">
      <p>You have no active journeys. Create one in Tabi to get started.</p>
      <a href="/tabi" class="prompt-link">Go to Tabi &rarr;</a>
    </div>
  </Card>
{:else}
  <div class="journey-toggle">
    <button
      class="toggle-option"
      class:toggle-active={journeyLens.isGlobalView}
      onclick={() => journeyLens.clear()}
    >
      Global view
    </button>
    {#each journeys as j (j.id)}
      <button
        class="toggle-option"
        class:toggle-active={journeyLens.selectedId === j.id}
        onclick={() => journeyLens.select(j.id)}
      >
        {j.name}
      </button>
    {/each}
  </div>

  <!-- Snapshot content -->
  {#if journeyLens.isGlobalView}
    <Card>
      <div class="empty-prompt">
        <p>Nothing configured for today. Select a journey above to see your snapshot, or visit your journey settings to get started.</p>
      </div>
    </Card>
  {:else if !hasModules}
    <Card>
      <div class="empty-prompt">
        <p>Nothing configured for today. Visit your journey settings to get started.</p>
        {#if selectedJourney}
          <a href="/tabi/{selectedJourney.id}" class="prompt-link">Open journey settings &rarr;</a>
        {/if}
      </div>
    </Card>
  {:else}
    <div class="snapshot-grid">
      <!-- Shoku -->
      {#if snapshot.shoku}
        {@const s = snapshot.shoku}
        {@const t = s.targets}
        <Card>
          <div class="widget">
            <div class="widget-header">
              <h3 class="widget-title">
                <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.shoku}</svg>
                Shoku
              </h3>
              <a href="/shoku" class="widget-link">View &rarr;</a>
            </div>

            {#if t.dailyCalorieTarget}
              <div class="widget-stat">
                <div class="stat-header">
                  <span class="stat-label">Calories</span>
                  <span class="stat-values">{Math.round(s.totals.calories)} / {t.dailyCalorieTarget} kcal</span>
                </div>
                <ProgressBar value={pct(s.totals.calories, t.dailyCalorieTarget)} />
              </div>
            {/if}

            {#if t.macros}
              {@const calTarget = t.dailyCalorieTarget ?? 2000}
              {#each [
                { label: "Protein", current: s.totals.protein, macro: t.macros.protein, cpg: 4 },
                { label: "Carbs", current: s.totals.carbs, macro: t.macros.carbs, cpg: 4 },
                { label: "Fat", current: s.totals.fat, macro: t.macros.fat, cpg: 9 },
              ] as m}
                {@const targetG = m.macro?.grams ?? (m.macro?.percentage ? Math.round((calTarget * (m.macro.percentage / 100)) / m.cpg) : null)}
                {#if targetG}
                  <div class="widget-stat">
                    <div class="stat-header">
                      <span class="stat-label">{m.label}</span>
                      <span class="stat-values">{Math.round(m.current)}g / {targetG}g</span>
                    </div>
                    <ProgressBar value={pct(m.current, targetG)} />
                  </div>
                {/if}
              {/each}
            {/if}

            {#if t.dailyWaterTargetOz}
              <div class="widget-stat">
                <div class="stat-header">
                  <span class="stat-label">Water</span>
                  <span class="stat-values">{s.waterOz} / {t.dailyWaterTargetOz} oz</span>
                </div>
                <ProgressBar value={pct(s.waterOz, t.dailyWaterTargetOz)} />
              </div>
            {/if}
          </div>
        </Card>
      {/if}

      <!-- Danjiki -->
      {#if snapshot.danjiki}
        {@const d = snapshot.danjiki}
        <Card>
          <div class="widget">
            <div class="widget-header">
              <h3 class="widget-title">
                <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.danjiki}</svg>
                Danjiki
              </h3>
              <a href="/danjiki" class="widget-link">View &rarr;</a>
            </div>

            {#if d.activeFast}
              {@const elapsed = Math.round((Date.now() - new Date(d.activeFast.startedAt).getTime()) / 3600000 * 10) / 10}
              {@const remaining = Math.max(0, d.activeFast.targetDuration - elapsed)}
              <div class="widget-stat">
                <div class="stat-header">
                  <span class="stat-label">Active fast</span>
                  <span class="stat-values">{elapsed}h / {d.activeFast.targetDuration}h</span>
                </div>
                <ProgressBar value={pct(elapsed, d.activeFast.targetDuration)} />
              </div>
              <p class="widget-detail">{remaining.toFixed(1)}h remaining</p>
            {:else if d.weeklyTarget}
              <div class="widget-stat">
                <div class="stat-header">
                  <span class="stat-label">Weekly fasting</span>
                  <span class="stat-values">{d.weeklyHoursFasted}h / {d.weeklyTarget}h</span>
                </div>
                <ProgressBar value={pct(d.weeklyHoursFasted, d.weeklyTarget)} />
              </div>
            {:else}
              <p class="widget-detail">{d.weeklyHoursFasted}h fasted this week</p>
            {/if}
          </div>
        </Card>
      {/if}

      <!-- Dojo -->
      {#if snapshot.dojo}
        {@const dj = snapshot.dojo}
        <Card>
          <div class="widget">
            <div class="widget-header">
              <h3 class="widget-title">
                <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.dojo}</svg>
                Dojo
              </h3>
              <a href="/dojo" class="widget-link">View &rarr;</a>
            </div>

            {#if dj.todaySessions.length > 0}
              <div class="today-session">
                <span class="stat-label">Today's workout</span>
                {#each dj.todaySessions as session}
                  <p class="session-name">{session.planName} &mdash; {session.sessionName}</p>
                {/each}
              </div>
            {/if}

            {#if dj.sessionsPerWeek}
              <div class="widget-stat">
                <div class="stat-header">
                  <span class="stat-label">Sessions this week</span>
                  <span class="stat-values">{dj.sessionsThisWeek} / {dj.sessionsPerWeek}</span>
                </div>
                <ProgressBar value={pct(dj.sessionsThisWeek, dj.sessionsPerWeek)} />
              </div>
            {/if}

            {#if dj.weeklyCalorieBurn}
              <div class="widget-stat">
                <div class="stat-header">
                  <span class="stat-label">Calories burned</span>
                  <span class="stat-values">0 / {dj.weeklyCalorieBurn} kcal</span>
                </div>
                <ProgressBar value={0} />
              </div>
            {/if}

            {#if !dj.todaySessions.length && !dj.sessionsPerWeek && !dj.weeklyCalorieBurn}
              <p class="widget-detail">No workouts scheduled for today</p>
            {/if}
          </div>
        </Card>
      {/if}

      <!-- Kata -->
      {#if snapshot.kata}
        {@const k = snapshot.kata}
        <Card>
          <div class="widget">
            <div class="widget-header">
              <h3 class="widget-title">
                <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.kata}</svg>
                Kata
              </h3>
              <a href="/kata" class="widget-link">View &rarr;</a>
            </div>

            {#each k.commitments as c}
              <div class="widget-stat">
                <div class="stat-header">
                  <div class="commitment-header">
                    <span class="stat-label">{c.name}</span>
                    <span class="commitment-status" class:logged={c.loggedToday}>
                      {c.loggedToday ? "Logged" : "Not yet"}
                    </span>
                  </div>
                  <span class="stat-values">
                    {c.progress.current}{c.unit ? ` ${c.unit}` : ""} / {c.progress.target}
                  </span>
                </div>
                <ProgressBar value={c.progress.percentage} />
              </div>
            {/each}
          </div>
        </Card>
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* Journey toggle */
  .journey-toggle {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }

  .toggle-option {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toggle-option:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .toggle-active {
    border-color: var(--accent);
    color: var(--accent);
    background: transparent;
  }

  /* Empty prompt */
  .empty-prompt {
    text-align: center;
    padding: var(--space-4) var(--space-2);
  }

  .empty-prompt p {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-light);
    margin: 0 0 var(--space-4) 0;
  }

  .prompt-link {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
    text-decoration: none;
    transition: opacity var(--transition-fast);
  }

  .prompt-link:hover {
    opacity: 0.8;
  }

  /* Snapshot grid */
  .snapshot-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  @media (min-width: 768px) {
    .snapshot-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Widget shared */
  .widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .widget-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .widget-icon {
    flex-shrink: 0;
  }

  .widget-link {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .widget-link:hover {
    color: var(--accent);
  }

  .widget-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stat-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .stat-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .stat-values {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    font-variant-numeric: tabular-nums;
  }

  .widget-detail {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  /* Dojo today session */
  .today-session {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .session-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    margin: 0;
  }

  /* Kata commitment status */
  .commitment-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .commitment-status {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--paper-warm);
    color: var(--ink-faint);
  }

  .commitment-status.logged {
    background: var(--accent-green-soft);
    color: var(--accent-green);
  }
</style>
