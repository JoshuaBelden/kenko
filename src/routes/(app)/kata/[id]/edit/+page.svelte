<script lang="ts">
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"

  const commitment = $derived(page.data.commitment)
  const activeJourneys = $derived(page.data.activeJourneys ?? [])

  let name = $state(commitment?.name ?? "")
  let description = $state(commitment?.description ?? "")
  let direction = $state<"achieve" | "limit">(commitment?.direction ?? "achieve")
  let period = $state<"daily" | "weekly" | "monthly" | "journey_total">(commitment?.period ?? "daily")
  let loggingStyle = $state<"checkbox" | "quantity">(commitment?.loggingStyle ?? "checkbox")
  let targetValue = $state(commitment?.targetValue ?? 1)
  let unit = $state(commitment?.unit ?? "")
  let journeyId = $state<string | null>(commitment?.journeyId ?? null)
  let saving = $state(false)
  let deleting = $state(false)
  let error = $state("")

  async function handleDelete() {
    if (!confirm("Delete this commitment? This cannot be undone.")) return
    deleting = true
    const res = await fetch(`/api/kata/commitments/${commitment.id}`, { method: "DELETE" })
    if (!res.ok) {
      error = "Failed to delete commitment"
      deleting = false
      return
    }
    goto("/kata")
  }

  async function handleSubmit() {
    if (!name.trim()) {
      error = "Name is required"
      return
    }
    if (targetValue <= 0) {
      error = "Target must be a positive number"
      return
    }

    saving = true
    error = ""

    const res = await fetch(`/api/kata/commitments/${commitment.id}`, {
      method: "PUT",
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
      error = data.error || "Failed to update commitment"
      saving = false
      return
    }

    goto(`/kata/${commitment.id}`)
  }
</script>

{#if !commitment}
  <PageHeader kanji="型" title="Not Found" />
  <div class="empty-state">
    <p>This commitment doesn't exist.</p>
    <Button variant="primary" href="/kata">Back to Kata</Button>
  </div>
{:else}
  <PageHeader kanji="型" title="Edit Commitment" subtitle={commitment.name} />

  <Card>
    <form class="form" onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
      {#if error}
        <div class="error">{error}</div>
      {/if}

      <div class="field">
        <label class="label" for="name">Name</label>
        <input id="name" class="input" type="text" bind:value={name} required />
      </div>

      <div class="field">
        <label class="label" for="description">Description</label>
        <textarea id="description" class="input textarea" bind:value={description} rows="2"></textarea>
      </div>

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
        <Button variant="ghost" href="/kata/{commitment.id}">Cancel</Button>
        <div class="actions-right">
          <button type="button" class="delete-btn" disabled={deleting} onclick={handleDelete}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <button type="submit" class="submit-btn" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  </Card>
{/if}

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
    border-radius: var(--radius-pill);
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

  .actions-right {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .delete-btn {
    padding: var(--space-2) var(--space-5);
    border: 0.5px solid var(--accent);
    border-radius: var(--radius-pill);
    background: none;
    color: var(--accent);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn:hover {
    background: var(--accent);
    color: white;
  }

  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn {
    padding: var(--space-2) var(--space-5);
    border: none;
    border-radius: var(--radius-pill);
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
