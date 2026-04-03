<script lang="ts">
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"

  const activeJourneys = $derived(page.data.activeJourneys ?? [])

  let commitmentMode = $state<"standard" | "taper">("standard")
  let name = $state("")
  let description = $state("")
  let direction = $state<"achieve" | "limit">("achieve")
  let period = $state<"daily" | "weekly" | "monthly" | "journey_total">("daily")
  let loggingStyle = $state<"checkbox" | "quantity">("checkbox")
  let targetValue = $state(1)
  let unit = $state("")
  let journeyId = $state<string | null>(null)
  let saving = $state(false)
  let error = $state("")

  // Taper-specific state
  let taperUnit = $state("")
  let taperStartDate = $state(new Date().toISOString().slice(0, 10))
  let taperPhases = $state<Array<{ weekNumber: number; label: string; dailyLimit: number }>>([
    { weekNumber: 1, label: "Week 1", dailyLimit: 10 },
  ])

  function addPhase() {
    const nextWeek = taperPhases.length > 0 ? taperPhases[taperPhases.length - 1].weekNumber + 1 : 1
    taperPhases = [...taperPhases, { weekNumber: nextWeek, label: `Week ${nextWeek}`, dailyLimit: 0 }]
  }

  function removePhase(index: number) {
    taperPhases = taperPhases.filter((_, i) => i !== index)
  }

  async function handleSubmit() {
    if (!name.trim()) {
      error = "Name is required"
      return
    }

    if (commitmentMode === "taper") {
      if (!taperUnit.trim()) {
        error = "Unit is required for taper commitments"
        return
      }
      if (!taperStartDate) {
        error = "Start date is required"
        return
      }
      if (taperPhases.length === 0) {
        error = "At least one phase is required"
        return
      }

      saving = true
      error = ""

      const res = await fetch("/api/kata/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type: "taper",
          unit: taperUnit.trim(),
          startDate: new Date(taperStartDate + "T00:00:00Z").toISOString(),
          taperPhases: taperPhases.map((p) => ({
            weekNumber: p.weekNumber,
            label: p.label.trim() || `Week ${p.weekNumber}`,
            dailyLimit: p.dailyLimit,
          })),
          journeyId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        error = data.error || "Failed to create commitment"
        saving = false
        return
      }

      goto("/kata")
      return
    }

    // Standard commitment
    if (targetValue <= 0) {
      error = "Target must be a positive number"
      return
    }

    saving = true
    error = ""

    const res = await fetch("/api/kata/commitments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        direction,
        period,
        loggingStyle,
        targetValue,
        unit: loggingStyle === "quantity" ? unit.trim() || null : null,
        journeyId,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      error = data.error || "Failed to create commitment"
      saving = false
      return
    }

    goto("/kata")
  }
</script>

<PageHeader icon={icons.kata} title="New Commitment" subtitle="Define a kata" />

<Card>
  <form class="form" onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
    {#if error}
      <div class="error">{error}</div>
    {/if}

    <div class="field">
      <label class="label" for="name">Name</label>
      <input id="name" class="input" type="text" bind:value={name} placeholder="e.g. Morning meditation" required />
    </div>

    <div class="field">
      <label class="label" for="description">Description</label>
      <textarea id="description" class="input textarea" bind:value={description} placeholder="Optional details..." rows="2"></textarea>
    </div>

    <div class="field">
      <span class="label">Type</span>
      <div class="toggle-group">
        <button type="button" class="toggle-btn" class:active={commitmentMode === "standard"} onclick={() => commitmentMode = "standard"}>
          Standard
        </button>
        <button type="button" class="toggle-btn" class:active={commitmentMode === "taper"} onclick={() => commitmentMode = "taper"}>
          Taper
        </button>
      </div>
    </div>

    {#if commitmentMode === "taper"}
      <div class="field">
        <label class="label" for="taper-unit">Unit</label>
        <input id="taper-unit" class="input" type="text" bind:value={taperUnit} placeholder="e.g. pouches, cigarettes, drinks" required />
      </div>

      <div class="field">
        <label class="label" for="taper-start">Start Date</label>
        <input id="taper-start" class="input" type="date" bind:value={taperStartDate} />
      </div>

      <div class="field">
        <span class="label">Phase Schedule</span>
        <div class="phase-list">
          {#each taperPhases as phase, i}
            <div class="phase-row">
              <span class="phase-week">Wk {phase.weekNumber}</span>
              <input
                class="input phase-label-input"
                type="text"
                bind:value={phase.label}
                placeholder="Week {phase.weekNumber}"
              />
              <input
                class="input phase-limit-input"
                type="number"
                bind:value={phase.dailyLimit}
                min="0"
                step="1"
                placeholder="0"
              />
              <span class="phase-unit-label">/day</span>
              <button type="button" class="phase-delete" onclick={() => removePhase(i)} aria-label="Remove phase">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
        <button type="button" class="add-phase-btn" onclick={addPhase}>+ Add Phase</button>
      </div>
    {:else}
      <div class="field">
        <span class="label">Logging Style</span>
        <div class="toggle-group">
          <button type="button" class="toggle-btn" class:active={loggingStyle === "checkbox"} onclick={() => { loggingStyle = "checkbox"; targetValue = 1; direction = "achieve" }}>
            Checkbox
          </button>
          <button type="button" class="toggle-btn" class:active={loggingStyle === "quantity"} onclick={() => loggingStyle = "quantity"}>
            Quantity
          </button>
        </div>
      </div>

      {#if loggingStyle === "quantity"}
        <div class="field">
          <span class="label">Direction</span>
          <div class="toggle-group">
            <button type="button" class="toggle-btn" class:active={direction === "achieve"} onclick={() => direction = "achieve"}>
              Achieve
            </button>
            <button type="button" class="toggle-btn" class:active={direction === "limit"} onclick={() => direction = "limit"}>
              Limit
            </button>
          </div>
        </div>
      {/if}

      <div class="field">
        <span class="label">Period</span>
        <div class="toggle-group">
          <button type="button" class="toggle-btn" class:active={period === "daily"} onclick={() => period = "daily"}>Daily</button>
          <button type="button" class="toggle-btn" class:active={period === "weekly"} onclick={() => period = "weekly"}>Weekly</button>
          <button type="button" class="toggle-btn" class:active={period === "monthly"} onclick={() => period = "monthly"}>Monthly</button>
          <button type="button" class="toggle-btn" class:active={period === "journey_total"} onclick={() => period = "journey_total"}>Journey</button>
        </div>
      </div>

      {#if loggingStyle === "quantity"}
        <div class="field">
          <label class="label" for="target">Target</label>
          <div class="target-row">
            <input id="target" class="input target-input" type="number" bind:value={targetValue} min="1" step="any" />
            <input class="input unit-input" type="text" bind:value={unit} placeholder="unit (e.g. minutes)" />
          </div>
        </div>
      {/if}
    {/if}

    <div class="field">
      <label class="label" for="journey">Journey</label>
      <select id="journey" class="input select" bind:value={journeyId}>
        <option value={null}>Evergreen (no journey)</option>
        {#each activeJourneys as journey}
          <option value={journey.id}>{journey.name}</option>
        {/each}
      </select>
    </div>

    <div class="actions">
      <Button variant="ghost" href="/kata">Cancel</Button>
      <button type="submit" class="submit-btn" disabled={saving}>
        {saving ? "Creating..." : "Create Commitment"}
      </button>
    </div>
  </form>
</Card>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .input {
    padding: var(--space-2) 0;
    border: none;
    border-bottom: 1px solid var(--border);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .input:focus {
    border-color: var(--accent-green);
  }

  .input::placeholder {
    color: var(--ink-faint);
  }

  .textarea {
    resize: vertical;
    min-height: 2.5rem;
  }

  .select {
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0 center;
    padding-right: var(--space-4);
  }

  .toggle-group {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .toggle-btn {
    padding: var(--space-1) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toggle-btn:hover {
    border-color: var(--ink-light);
  }

  .toggle-btn.active {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .target-row {
    display: flex;
    gap: var(--space-3);
    align-items: end;
  }

  .target-input {
    width: 80px;
  }

  .unit-input {
    flex: 1;
  }

  .error {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-3);
  }

  .submit-btn {
    padding: var(--space-2) var(--space-5);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: white;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }

  .submit-btn:hover {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Taper phase builder */
  .phase-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .phase-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .phase-week {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    width: 32px;
    flex-shrink: 0;
  }

  .phase-label-input {
    flex: 1;
    font-size: var(--text-sm) !important;
  }

  .phase-limit-input {
    width: 60px;
    text-align: center;
    font-size: var(--text-sm) !important;
  }

  .phase-unit-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    flex-shrink: 0;
  }

  .phase-delete {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--ink-faint);
    flex-shrink: 0;
  }

  .phase-delete:hover {
    color: var(--accent);
  }

  .add-phase-btn {
    padding: var(--space-1) var(--space-3);
    border: 0.5px dashed var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-top: var(--space-2);
  }

  .add-phase-btn:hover {
    border-color: var(--ink-light);
    color: var(--ink-light);
  }
</style>
