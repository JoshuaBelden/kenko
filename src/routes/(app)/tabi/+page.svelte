<script lang="ts">
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"
  import { localToday, toDatetime } from "$lib/dates"
  import { formatDateRange } from "$lib/format"
  import { icons } from "$lib/icons"

  const tz = $derived(page.data.user?.profile?.timezone ?? "America/Los_Angeles")

  let journeys = $state(page.data.journeys ?? [])
  let creating = $state(false)
  let showArchived = $state(false)

  $effect(() => {
    journeys = page.data.journeys ?? []
  })

  const activeJourneys = $derived(
    journeys.filter(
      (j: any) => j.status === "active" && new Date(j.endDate) >= new Date(),
    ),
  )

  const endedJourneys = $derived(
    journeys.filter(
      (j: any) =>
        (j.status === "active" && new Date(j.endDate) < new Date()) ||
        j.status === "completed",
    ),
  )

  const archivedJourneys = $derived(
    journeys.filter((j: any) => j.status === "archived"),
  )

  // Create form state
  let newName = $state("")
  let newDescription = $state("")
  let newStartDate = $state("")
  let newStartTime = $state("00:00")
  let newEndDate = $state("")
  let newEndTime = $state("23:59")
  let createError = $state("")

  // Initialize date defaults from tz (reactive)
  $effect(() => {
    if (!newStartDate) {
      newStartDate = localToday(tz)
      const d = new Date()
      d.setFullYear(d.getFullYear() + 1)
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      newEndDate = fmt.format(d)
    }
  })

  function resetCreateForm() {
    newName = ""
    newDescription = ""
    newStartDate = localToday(tz)
    newStartTime = "00:00"
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    newEndDate = fmt.format(d)
    newEndTime = "23:59"
    createError = ""
  }

  async function handleCreate() {
    if (!newName.trim()) {
      createError = "Name is required"
      return
    }

    const res = await fetch("/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDescription.trim(),
        startDate: toDatetime(newStartDate, newStartTime, tz),
        endDate: toDatetime(newEndDate, newEndTime, tz),
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      createError = err.error ?? "Failed to create journey"
      return
    }

    const created = await res.json()
    creating = false
    resetCreateForm()
    // Navigate to the new journey's settings
    goto(`/tabi/${created.id}`)
  }
</script>

<PageHeader icon={icons.tabi} title="Tabi" subtitle="Every journey begins with a single step" />

{#if journeys.length === 0 && !creating}
  <section class="empty-state">
    <Card>
      <div class="empty-content">
        <p class="empty-message">
          Your data is being recorded, but you have no active journey. Journeys help you see your
          progress with intention — like chapters in a story.
        </p>
        <Button onclick={() => (creating = true)}>Create a journey</Button>
      </div>
    </Card>
  </section>
{:else}
  <section class="section">
    <div class="section-header">
      <div class="section-header-actions" style="margin-left: auto;">
        {#if archivedJourneys.length > 0}
          <button class="archived-toggle" onclick={() => (showArchived = !showArchived)}>
            {showArchived ? "Hide" : "Show"} archived
          </button>
        {/if}
        {#if !creating}
          <Button onclick={() => (creating = true)}>New Journey</Button>
        {/if}
      </div>
    </div>

    {#if creating}
      <Card>
        <div class="create-form">
          <h4>New Journey</h4>
          <div class="form-fields">
            <div class="form-field">
              <label class="field-label" for="journey-name">Name</label>
              <input id="journey-name" bind:value={newName} placeholder="e.g. Run a Marathon" />
            </div>
            <div class="form-field">
              <label class="field-label" for="journey-desc">Description</label>
              <input
                id="journey-desc"
                bind:value={newDescription}
                placeholder="What is this journey about?"
              />
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="field-label" for="journey-start">Start date</label>
                <input id="journey-start" type="date" bind:value={newStartDate} />
              </div>
              <div class="form-field">
                <label class="field-label" for="journey-start-time">Start time</label>
                <input id="journey-start-time" type="time" bind:value={newStartTime} />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="field-label" for="journey-end">End date</label>
                <input id="journey-end" type="date" bind:value={newEndDate} />
              </div>
              <div class="form-field">
                <label class="field-label" for="journey-end-time">End time</label>
                <input id="journey-end-time" type="time" bind:value={newEndTime} />
              </div>
            </div>
          </div>
          {#if createError}
            <p class="error">{createError}</p>
          {/if}
          <div class="form-actions">
            <Button onclick={handleCreate}>Create</Button>
            <button
              class="btn-text"
              onclick={() => {
                creating = false
                resetCreateForm()
              }}>Cancel</button
            >
          </div>
        </div>
      </Card>
    {/if}

    <!-- Active journeys -->
    {#if activeJourneys.length > 0}
      <div class="journey-list">
        {#each activeJourneys as journey (journey.id)}
          <a href="/tabi/{journey.id}" class="journey-card-link">
            <Card>
              <div class="journey-card active">
                <div class="journey-top">
                  <div>
                    <h4 class="journey-name">{journey.name}</h4>
                    <p class="journey-dates">
                      {formatDateRange(journey.startDate, journey.endDate, tz)}
                    </p>
                  </div>
                </div>
                {#if journey.description}
                  <p class="journey-description">{journey.description}</p>
                {/if}
              </div>
            </Card>
          </a>
        {/each}
      </div>
    {/if}

    <!-- Ended journeys -->
    {#if endedJourneys.length > 0}
      <div class="subsection">
        <h4 class="subsection-title">Ended</h4>
        <div class="journey-list">
          {#each endedJourneys as journey (journey.id)}
            <a href="/tabi/{journey.id}" class="journey-card-link">
              <Card>
                <div class="journey-card ended">
                  <div class="journey-top">
                    <div>
                      <h4 class="journey-name">{journey.name}</h4>
                      <p class="journey-dates">
                        {formatDateRange(journey.startDate, journey.endDate, tz)}
                      </p>
                    </div>
                    <span class="status-badge status-ended">Ended</span>
                  </div>
                </div>
              </Card>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Archived journeys (shown when toggled) -->
    {#if showArchived && archivedJourneys.length > 0}
      <div class="subsection">
        <h4 class="subsection-title">Archived</h4>
        <div class="journey-list">
          {#each archivedJourneys as journey (journey.id)}
            <a href="/tabi/{journey.id}" class="journey-card-link">
              <Card>
                <div class="journey-card archived">
                  <div class="journey-top">
                    <div>
                      <h4 class="journey-name">{journey.name}</h4>
                      <p class="journey-dates">
                        {formatDateRange(journey.startDate, journey.endDate, tz)}
                      </p>
                    </div>
                    <span class="status-badge status-archived">Archived</span>
                  </div>
                </div>
              </Card>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .section {
    margin-bottom: var(--space-8);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }

  .subsection {
    margin-top: var(--space-6);
  }

  .subsection-title {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
    margin: 0 0 var(--space-3) 0;
  }

  /* ── Empty state ── */
  .empty-state {
    margin-top: var(--space-8);
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }

  .empty-content {
    text-align: center;
    padding: var(--space-4);
  }

  .empty-message {
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-light);
    margin-bottom: var(--space-6);
  }

  /* ── Journey list ── */
  .journey-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .journey-card-link {
    text-decoration: none;
    color: inherit;
    display: block;
    transition: transform var(--transition-fast);
  }

  .journey-card-link:hover {
    transform: translateX(2px);
  }

  .journey-card {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    padding: 0;
    font-family: var(--font-body);
    transition: border-color var(--transition-fast);
  }

  .journey-card.active {
    border-left-color: var(--accent-green);
  }

  .journey-card.ended {
    border-left-color: var(--ink-faint);
    opacity: 0.75;
  }

  .journey-card.archived {
    border-left-color: transparent;
    opacity: 0.5;
  }

  .journey-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .journey-name {
    font-size: var(--text-lg);
    margin: 0;
  }

  .journey-dates {
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin-top: var(--space-1);
  }

  .journey-description {
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-light);
    margin-top: var(--space-2);
    margin-bottom: 0;
  }

  /* ── Status badge ── */
  .status-badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .status-ended {
    color: var(--ink-light);
    background: var(--paper-warm);
  }

  .status-archived {
    color: var(--ink-faint);
    background: var(--paper-warm);
    opacity: 0.7;
  }

  .section-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* ── Archived toggle ── */
  .archived-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    padding: var(--space-2) 0;
    margin-bottom: var(--space-3);
    transition: color var(--transition-fast);
  }

  .archived-toggle:hover {
    color: var(--ink-light);
  }

  /* ── Create form ── */
  .create-form {
    margin-bottom: var(--space-3);
  }

  .create-form h4 {
    margin-bottom: var(--space-4);
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .form-field input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    transition: border-color var(--transition-fast);
    width: 100%;
  }

  .form-field input[type="time"] {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    transition: border-color var(--transition-fast);
    width: 100%;
  }

  .form-field input:focus {
    border-bottom-color: var(--border-strong);
  }

  .form-field input::placeholder {
    color: var(--ink-faint);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .form-row {
    display: flex;
    gap: var(--space-4);
  }

  .form-row .form-field {
    flex: 1;
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .error {
    font-size: var(--text-sm);
    color: var(--accent);
    margin-bottom: var(--space-3);
  }

  /* ── Text buttons ── */
  .btn-text {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .btn-text:hover {
    color: var(--ink);
  }
</style>
