<script lang="ts">
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"

  let plans = $state(page.data.plans ?? [])
  $effect(() => {
    plans = page.data.plans ?? []
  })

  let creating = $state(false)
  let fPlanName = $state("")
  let formError = $state("")
  let creatingPlan = $state(false)

  function startCreatePlan() {
    creating = true
    fPlanName = ""
    formError = ""
  }

  function cancelCreatePlan() {
    creating = false
    fPlanName = ""
    formError = ""
  }

  async function handleCreatePlan() {
    if (!fPlanName.trim()) {
      formError = "Plan name is required"
      return
    }

    creatingPlan = true
    const res = await fetch("/api/dojo/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fPlanName.trim(), sessions: [] }),
    })
    creatingPlan = false

    if (!res.ok) {
      const data = await res.json()
      formError = data.error ?? "Failed to create plan"
      return
    }

    const created = await res.json()
    goto(`/dojo/plans/${created.id}/edit`)
  }

  let importInput = $state<HTMLInputElement>(undefined!)

  async function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch("/api/dojo/plans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? "Import failed")
        return
      }
      const imported = await res.json()
      plans = [imported, ...plans]
    } catch {
      alert("Invalid file format")
    } finally {
      if (importInput) importInput.value = ""
    }
  }
</script>

<PageHeader icon={icons.dojo} title="Workout Plans" subtitle="Design your training programs" />

<div class="plans-controls">
  {#if !creating}
    <Button variant="secondary" onclick={() => importInput.click()}>Import</Button>
    <input type="file" accept=".json" bind:this={importInput} onchange={handleImportFile} class="hidden-input" />
    <Button variant="primary" onclick={startCreatePlan}>+ New Plan</Button>
  {/if}
</div>

{#if creating}
  <Card>
    <div class="form">
      <h3 class="form-title">New Plan</h3>

      <div class="form-field">
        <label class="field-label">Plan Name</label>
        <input type="text" class="field-input" bind:value={fPlanName} placeholder="e.g. Push Pull Legs" />
      </div>

      {#if formError}
        <p class="form-error">{formError}</p>
      {/if}

      <div class="form-actions">
        <div class="form-actions-right">
          <Button variant="primary" onclick={handleCreatePlan} disabled={creatingPlan}>Create Plan</Button>
          <Button variant="secondary" onclick={cancelCreatePlan}>Cancel</Button>
        </div>
      </div>
    </div>
  </Card>
{/if}

<div class="plan-list">
  {#each plans as plan (plan.id)}
    <Card>
      <div class="plan-card">
        <div class="plan-header">
          <h3 class="plan-name">{plan.name}</h3>
          <span class="plan-sessions-count">{plan.sessions.length} {plan.sessions.length === 1 ? "session" : "sessions"}</span>
        </div>
        <div class="plan-actions">
          <a class="edit-btn" href="/dojo/plans/{plan.id}">Open</a>
          <a class="edit-btn" href="/dojo/plans/{plan.id}/edit">Edit</a>
        </div>
      </div>
    </Card>
  {/each}
</div>

{#if plans.length === 0 && !creating}
  <div class="empty-state">
    <p>No workout plans yet. Create a plan to start training.</p>
  </div>
{/if}

<style>
  .plans-controls {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }

  .plan-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  .field-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2) 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .field-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .form-error {
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-start;
    align-items: center;
  }

  .form-actions-right {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .plan-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .plan-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .plan-name {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .plan-sessions-count {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .plan-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
  }

  .edit-btn {
    padding: var(--space-2) var(--space-5);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-light);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .edit-btn:hover {
    border-color: var(--ink);
    color: var(--ink);
  }

  .hidden-input {
    display: none;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }
</style>
