<script lang="ts">
  import { invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"
  import { onDestroy, onMount } from "svelte"

  const PRESETS = [12, 16, 18, 20, 24, 36, 48]

  const activeFast = $derived(page.data.activeFast)
  const fasts = $derived(page.data.fasts ?? [])

  // Start fast state
  let selectedDuration = $state<number | null>(null)
  let customDuration = $state("")
  let isCustom = $state(false)
  let starting = $state(false)

  // Active fast timer
  let now = $state(Date.now())
  let timerInterval: ReturnType<typeof setInterval> | null = null

  // Edit state
  let editingId = $state<string | null>(null)
  let editDuration = $state("")
  let editNote = $state("")

  // Delete confirmation
  let confirmDeleteId = $state<string | null>(null)

  // End fast confirmation
  let confirmEnd = $state(false)

  // Note editing for active fast
  let activeNote = $state("")
  let savingNote = $state(false)

  $effect(() => {
    if (activeFast) {
      activeNote = activeFast.note ?? ""
    }
  })

  onMount(() => {
    timerInterval = setInterval(() => {
      now = Date.now()
    }, 1000)
  })

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval)
  })

  const effectiveDuration = $derived(isCustom ? parseFloat(customDuration) : selectedDuration)
  const canStart = $derived(effectiveDuration != null && effectiveDuration > 0 && !isNaN(effectiveDuration))

  function elapsedMs(startedAt: string): number {
    return Math.max(0, now - new Date(startedAt).getTime())
  }

  function remainingMs(startedAt: string, targetHours: number): number {
    const target = targetHours * 60 * 60 * 1000
    return Math.max(0, target - elapsedMs(startedAt))
  }

  function progressPercent(startedAt: string, targetHours: number): number {
    const target = targetHours * 60 * 60 * 1000
    if (target === 0) return 100
    return Math.min(100, (elapsedMs(startedAt) / target) * 100)
  }

  function targetReached(startedAt: string, targetHours: number): boolean {
    return elapsedMs(startedAt) >= targetHours * 60 * 60 * 1000
  }

  function formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h}h ${m}m`
  }

  function formatHours(hours: number): string {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  function formatDateTime(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " at " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }

  function selectPreset(hours: number) {
    isCustom = false
    selectedDuration = hours
  }

  function selectCustom() {
    isCustom = true
    selectedDuration = null
  }

  async function startFast() {
    if (!canStart || starting) return
    starting = true
    try {
      const res = await fetch("/api/danjiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDuration: effectiveDuration }),
      })
      if (res.ok) {
        selectedDuration = null
        customDuration = ""
        isCustom = false
        await invalidateAll()
      }
    } finally {
      starting = false
    }
  }

  async function endFast() {
    if (!activeFast) return
    const res = await fetch(`/api/danjiki/${activeFast.id}/end`, { method: "PUT" })
    if (res.ok) {
      confirmEnd = false
      await invalidateAll()
    }
  }

  async function saveActiveNote() {
    if (!activeFast || savingNote) return
    savingNote = true
    try {
      await fetch(`/api/danjiki/${activeFast.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: activeNote }),
      })
    } finally {
      savingNote = false
    }
  }

  function startEdit(fast: any) {
    editingId = fast.id
    editDuration = String(fast.actualDuration ?? "")
    editNote = fast.note ?? ""
  }

  function cancelEdit() {
    editingId = null
    editDuration = ""
    editNote = ""
  }

  async function saveEdit(id: string) {
    const updates: Record<string, unknown> = {}
    const dur = parseFloat(editDuration)
    if (!isNaN(dur) && dur >= 0) updates.actualDuration = dur
    updates.note = editNote.trim() || null

    const res = await fetch(`/api/danjiki/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      cancelEdit()
      await invalidateAll()
    }
  }

  async function deleteFast(id: string) {
    const res = await fetch(`/api/danjiki/${id}`, { method: "DELETE" })
    if (res.ok) {
      confirmDeleteId = null
      await invalidateAll()
    }
  }
</script>

<PageHeader icon={icons.danjiki} title="Danjiki" subtitle="Discipline through fasting" />

<!-- Active fast -->
{#if activeFast}
  <section class="section">
    <Card>
      <div class="active-fast">
        <div class="active-header">
          <strong class="active-title">{activeFast.targetDuration} hour fast</strong>
          <span class="active-started">Started {formatDateTime(activeFast.startedAt)}</span>
        </div>

        <div class="timer-row">
          <div class="timer-item">
            <span class="timer-label">Elapsed</span>
            <span class="timer-value">{formatDuration(elapsedMs(activeFast.startedAt))}</span>
          </div>
          <div class="timer-item">
            <span class="timer-label">Remaining</span>
            <span class="timer-value">{formatDuration(remainingMs(activeFast.startedAt, activeFast.targetDuration))}</span>
          </div>
        </div>

        <div class="progress-track">
          <div
            class="progress-fill"
            class:reached={targetReached(activeFast.startedAt, activeFast.targetDuration)}
            style:width="{progressPercent(activeFast.startedAt, activeFast.targetDuration)}%"
          ></div>
        </div>

        <div class="note-row">
          <input
            type="text"
            class="note-input"
            placeholder="Add a note..."
            bind:value={activeNote}
            onblur={saveActiveNote}
          />
        </div>

        <div class="active-actions">
          {#if confirmEnd}
            <span class="confirm-text">End this fast?</span>
            <Button variant="primary" onclick={endFast}>Yes, end</Button>
            <Button variant="ghost" onclick={() => (confirmEnd = false)}>Cancel</Button>
          {:else}
            <Button variant="secondary" onclick={() => (confirmEnd = true)}>End Fast</Button>
          {/if}
        </div>
      </div>
    </Card>
  </section>
{:else}
  <!-- Start new fast -->
  <section class="section">
    <div class="presets-grid">
      {#each PRESETS as hours}
        <button
          class="preset-btn"
          class:selected={!isCustom && selectedDuration === hours}
          onclick={() => selectPreset(hours)}
        >
          {hours}h
        </button>
      {/each}
      <button
        class="preset-btn"
        class:selected={isCustom}
        onclick={selectCustom}
      >
        Custom
      </button>
    </div>

    {#if isCustom}
      <div class="custom-input-row">
        <input
          type="number"
          class="custom-input"
          placeholder="Hours"
          min="1"
          step="any"
          bind:value={customDuration}
        />
        <span class="custom-unit">hours</span>
      </div>
    {/if}

    <div class="start-action">
      <Button variant="primary" disabled={!canStart || starting} onclick={startFast}>
        Start Fast
      </Button>
    </div>
  </section>
{/if}

<!-- Previous fasts -->
{#if fasts.length > 0}
  <section class="section">
    <h2 class="section-title">Previous Fasts</h2>
    {#each fasts as fast (fast.id)}
      <Card>
        {#if editingId === fast.id}
          <div class="edit-form">
            <div class="edit-row">
              <label class="edit-label">
                Actual duration (hours)
                <input
                  type="number"
                  class="edit-input"
                  min="0"
                  step="any"
                  bind:value={editDuration}
                />
              </label>
            </div>
            <div class="edit-row">
              <label class="edit-label">
                Note
                <input
                  type="text"
                  class="edit-input"
                  placeholder="Optional note"
                  bind:value={editNote}
                />
              </label>
            </div>
            <div class="edit-actions">
              <Button variant="primary" onclick={() => saveEdit(fast.id)}>Save</Button>
              <Button variant="ghost" onclick={cancelEdit}>Cancel</Button>
            </div>
          </div>
        {:else}
          <div class="fast-card">
            <div class="fast-info">
              <div class="fast-header">
                <strong class="fast-date">{formatDateTime(fast.startedAt)}</strong>
              </div>
              <div class="fast-details">
                <span class="fast-detail">Target: {fast.targetDuration}h</span>
                <span class="fast-detail">Actual: {fast.actualDuration != null ? formatHours(fast.actualDuration) : "—"}</span>
              </div>
              {#if fast.note}
                <p class="fast-note">{fast.note}</p>
              {/if}
            </div>
            <div class="fast-actions">
              <button class="action-btn" onclick={() => startEdit(fast)} aria-label="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              {#if confirmDeleteId === fast.id}
                <span class="confirm-text">Delete?</span>
                <button class="action-btn delete" onclick={() => deleteFast(fast.id)} aria-label="Confirm delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button class="action-btn" onclick={() => (confirmDeleteId = null)} aria-label="Cancel delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              {:else}
                <button class="action-btn" onclick={() => (confirmDeleteId = fast.id)} aria-label="Delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </Card>
    {/each}
  </section>
{/if}

{#if !activeFast && fasts.length === 0}
  <section class="section">
    <div class="empty-state">
      <p>No fasts yet. Choose a duration above to begin your first fast.</p>
    </div>
  </section>
{/if}

<style>
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

  /* Active fast */
  .active-fast {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .active-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .active-title {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--ink);
  }

  .active-started {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .timer-row {
    display: flex;
    gap: var(--space-8);
  }

  .timer-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .timer-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .timer-value {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 500;
    color: var(--ink);
  }

  .progress-track {
    height: 4px;
    background: var(--paper-warm);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-green);
    border-radius: var(--radius-pill);
    transition: width 1s linear;
  }

  .progress-fill.reached {
    background: var(--accent);
  }

  .note-row {
    display: flex;
  }

  .note-input {
    flex: 1;
    padding: var(--space-2) 0;
    border: none;
    border-bottom: 1px solid var(--border);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    outline: none;
  }

  .note-input:focus {
    border-color: var(--accent-green);
  }

  .note-input::placeholder {
    color: var(--ink-faint);
  }

  .active-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* Presets grid */
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .preset-btn {
    padding: var(--space-3) var(--space-4);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--paper-card);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .preset-btn:hover {
    border-color: var(--ink-faint);
    color: var(--ink);
  }

  .preset-btn.selected {
    border-color: var(--accent-green);
    color: var(--accent-green);
    background: var(--paper-warm);
  }

  .custom-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .custom-input {
    width: 100px;
    padding: var(--space-2) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--paper-card);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    outline: none;
  }

  .custom-input:focus {
    border-color: var(--accent-green);
  }

  .custom-unit {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  .start-action {
    margin-top: var(--space-4);
  }

  /* Fast cards */
  .fast-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .fast-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .fast-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .fast-date {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .fast-details {
    display: flex;
    gap: var(--space-4);
  }

  .fast-detail {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .fast-note {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    font-style: italic;
    margin: 0;
  }

  .fast-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-faint);
    transition: color var(--transition-fast);
    padding: 0;
  }

  .action-btn:hover {
    color: var(--ink);
  }

  .action-btn.delete {
    color: var(--accent);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
  }

  /* Edit form */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .edit-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .edit-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .edit-input {
    padding: var(--space-2) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    outline: none;
  }

  .edit-input:focus {
    border-color: var(--accent-green);
  }

  .edit-actions {
    display: flex;
    gap: var(--space-2);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-6);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }
</style>
