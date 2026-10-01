<script lang="ts">
  import { browser } from "$app/environment"
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import DOMPurify from "dompurify"
  import { marked } from "marked"
  import { Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"
  import {
    PLAN_GENERATOR_MAX_USER_TURNS,
    countNewExercises,
    type DraftMessage,
    type PlanDraft,
  } from "$lib/planDraft"

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const hasApiKey = $derived(page.data.hasApiKey ?? false)

  let prompt = $state("")
  /** Conversation sent so far, always ending with the user's latest request. */
  let history = $state<DraftMessage[]>([])
  let draft = $state<PlanDraft | null>(null)
  let revision = $state("")
  let loading = $state(false)
  let applying = $state(false)
  let error = $state("")
  let removingSession = $state<number | null>(null)
  let confirmDiscard = $state(false)

  const requests = $derived(history.filter((m) => m.role === "user").map((m) => m.content))
  const newCount = $derived(draft ? countNewExercises(draft) : 0)
  const canRevise = $derived(requests.length < PLAN_GENERATOR_MAX_USER_TURNS)

  function renderMarkdown(text: string): string {
    const html = marked.parse(text, { async: false, breaks: true })
    return browser ? DOMPurify.sanitize(html) : ""
  }

  function muscleLabel(muscle: string): string {
    return muscle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  /** The draft in the model's output shape, so revisions see the user's hand edits. */
  function draftAsAssistantMessage(d: PlanDraft): DraftMessage {
    return {
      role: "assistant",
      content: JSON.stringify({
        name: d.name,
        summary: d.summary,
        sessions: d.sessions.map((s) => ({
          name: s.name,
          targetDayOfWeek: s.targetDayOfWeek,
          exercises: s.exercises.map((e) => ({
            libraryExerciseId: e.exerciseId,
            name: e.name,
            muscle: e.muscle,
            equipment: e.equipment,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            restSeconds: e.restSeconds,
            note: e.note,
          })),
        })),
      }),
    }
  }

  async function requestDraft(messages: DraftMessage[]): Promise<boolean> {
    loading = true
    error = ""
    try {
      const res = await fetch("/api/dojo/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        error = data.error ?? "Couldn't generate a plan. Please try again."
        return false
      }
      history = messages
      draft = data.draft
      return true
    } catch {
      error = "Couldn't reach the server. Please try again."
      return false
    } finally {
      loading = false
    }
  }

  async function generate() {
    const text = prompt.trim()
    if (!text) {
      error = "Describe the plan you want"
      return
    }
    await requestDraft([{ role: "user", content: text }])
  }

  async function revise() {
    const text = revision.trim()
    if (!text || !draft) return
    const ok = await requestDraft([...history, draftAsAssistantMessage(draft), { role: "user", content: text }])
    if (ok) revision = ""
  }

  function onReviseKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      revise()
    }
  }

  function removeExercise(sessionIndex: number, exerciseIndex: number) {
    if (!draft) return
    draft.sessions[sessionIndex].exercises.splice(exerciseIndex, 1)
  }

  function removeSession(sessionIndex: number) {
    if (!draft) return
    draft.sessions.splice(sessionIndex, 1)
    removingSession = null
  }

  function discard() {
    draft = null
    history = []
    revision = ""
    error = ""
    confirmDiscard = false
  }

  async function apply() {
    if (!draft) return
    if (!draft.name.trim()) {
      error = "Plan name is required"
      return
    }
    if (!draft.sessions.some((s) => s.exercises.length > 0)) {
      error = "The plan needs at least one session with exercises"
      return
    }

    applying = true
    error = ""
    const res = await fetch("/api/dojo/plans/generate/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft }),
    })
    applying = false

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      error = data.error ?? "Failed to save plan"
      return
    }
    goto(`/dojo/plans/${data.id}`)
  }
</script>

<PageHeader icon={icons.dojo} title="Generate Plan" subtitle="Let your trainer draft a program" />

<div class="back-row">
  <a href="/dojo/plans" class="back-link">← Workout Plans</a>
</div>

{#if !hasApiKey}
  <Card>
    <p class="muted">
      Plan generation uses your trainer's Anthropic API key. Add one in <strong>Journey Settings → Trainer</strong> to
      get started.
    </p>
  </Card>
{:else if !draft}
  <Card>
    <div class="form">
      <h3 class="form-title">What are you looking for?</h3>
      <div class="form-field">
        <label class="field-label" for="plan-prompt">Describe the plan</label>
        <textarea
          id="plan-prompt"
          class="notes-input"
          rows="5"
          bind:value={prompt}
          disabled={loading}
          placeholder="e.g. 3 full-body lifting days, about 60 minutes each. I have barbells, dumbbells and cables. Focus on strength and muscle."
        ></textarea>
      </div>

      {#if error}
        <p class="form-error">{error}</p>
      {/if}

      <div class="form-actions">
        <Button variant="primary" onclick={generate} disabled={loading || !prompt.trim()}>
          {loading ? "Generating…" : "Generate"}
        </Button>
        <Button variant="secondary" href="/dojo/plans">Cancel</Button>
      </div>
      {#if loading}
        <p class="muted">Your trainer is building the plan. This can take a minute.</p>
      {/if}
    </div>
  </Card>
{:else}
  <section class="section">
    <Card>
      <div class="form">
        <div class="form-field">
          <label class="field-label" for="plan-name">Plan Name</label>
          <input id="plan-name" type="text" class="field-input plan-name-input" bind:value={draft.name} maxlength="80" />
        </div>
        {#if draft.summary}
          <div class="summary-markdown">{@html renderMarkdown(draft.summary)}</div>
        {/if}
        <p class="legend">
          {draft.sessions.length} {draft.sessions.length === 1 ? "session" : "sessions"}
          {#if newCount > 0}
            · <span class="new-badge">NEW</span> {newCount} new {newCount === 1 ? "exercise" : "exercises"} will be added to your library
          {:else}
            · all exercises are from your library
          {/if}
        </p>
      </div>
    </Card>
  </section>

  {#each draft.sessions as session, si}
    <section class="section">
      <Card>
        <div class="session">
          <div class="session-header">
            <input type="text" class="field-input session-name-input" aria-label="Session name" bind:value={session.name} maxlength="80" />
            <select class="field-input day-select" aria-label="Target day" bind:value={session.targetDayOfWeek}>
              <option value={null}>Any day</option>
              {#each DAY_NAMES as day, d}
                <option value={d}>{day}</option>
              {/each}
            </select>
            {#if removingSession === si}
              <div class="confirm-delete-inline">
                <span class="confirm-text">Remove?</span>
                <button class="confirm-btn yes" onclick={() => removeSession(si)}>Yes</button>
                <button class="confirm-btn no" onclick={() => (removingSession = null)}>No</button>
              </div>
            {:else}
              <button class="delete-btn-sm" onclick={() => (removingSession = si)}>Remove</button>
            {/if}
          </div>

          <div class="exercise-list">
            {#each session.exercises as ex, ei}
              <div class="exercise-row">
                <div class="exercise-info">
                  <div class="exercise-name">
                    {ex.name}
                    {#if ex.isNew}<span class="new-badge">NEW</span>{/if}
                  </div>
                  <div class="exercise-meta">{muscleLabel(ex.muscle)} · {muscleLabel(ex.equipment)}</div>
                  {#if ex.note}<div class="exercise-note">{ex.note}</div>{/if}
                </div>
                <div class="exercise-targets">
                  <label class="target">
                    <span class="target-label">Sets</span>
                    <input type="number" class="field-input target-input" min="1" max="10" bind:value={ex.targetSets} />
                  </label>
                  <label class="target">
                    <span class="target-label">Reps</span>
                    <input type="number" class="field-input target-input" min="1" max="50" bind:value={ex.targetReps} />
                  </label>
                  <label class="target">
                    <span class="target-label">Rest s</span>
                    <input type="number" class="field-input target-input" min="0" max="600" step="15" bind:value={ex.restSeconds} />
                  </label>
                  <button class="remove-btn" aria-label="Remove {ex.name}" onclick={() => removeExercise(si, ei)}>×</button>
                </div>
              </div>
            {:else}
              <p class="muted">No exercises. This session won't be saved.</p>
            {/each}
          </div>
        </div>
      </Card>
    </section>
  {/each}

  <section class="section">
    <Card>
      <div class="form">
        <h3 class="form-title">Ask for changes</h3>
        {#if requests.length > 0}
          <ol class="request-list">
            {#each requests as r}
              <li>{r}</li>
            {/each}
          </ol>
        {/if}
        {#if canRevise}
          <textarea
            class="notes-input"
            rows="2"
            aria-label="Requested changes"
            placeholder="e.g. Swap barbell back squat for goblet squat on day 2, and add more pulling."
            bind:value={revision}
            onkeydown={onReviseKeydown}
            disabled={loading || applying}
          ></textarea>
          <div class="form-actions">
            <Button variant="secondary" onclick={revise} disabled={loading || applying || !revision.trim()}>
              {loading ? "Revising…" : "Revise"}
            </Button>
          </div>
        {:else}
          <p class="muted">Revision limit reached. Apply this plan and fine-tune it in the plan editor.</p>
        {/if}
      </div>
    </Card>
  </section>

  {#if error}
    <p class="form-error">{error}</p>
  {/if}

  <div class="form-actions footer-actions">
    <Button variant="primary" onclick={apply} disabled={applying || loading}>
      {applying ? "Saving…" : "Apply"}
    </Button>
    {#if confirmDiscard}
      <div class="confirm-delete-inline">
        <span class="confirm-text">Discard draft?</span>
        <button class="confirm-btn yes" onclick={discard}>Yes</button>
        <button class="confirm-btn no" onclick={() => (confirmDiscard = false)}>No</button>
      </div>
    {:else}
      <Button variant="secondary" onclick={() => (confirmDiscard = true)} disabled={applying || loading}>Discard</Button>
    {/if}
  </div>
{/if}

<style>
  .back-row {
    margin-bottom: var(--space-4);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--ink-light);
  }

  .section {
    margin-bottom: var(--space-4);
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
    margin: 0;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-family: var(--font-body);
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

  .plan-name-input {
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .notes-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--ink);
    outline: none;
    resize: vertical;
    transition: border-color var(--transition-fast);
  }

  .notes-input:focus {
    border-color: var(--border-strong);
  }

  .form-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
    margin: 0 0 var(--space-3);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .footer-actions {
    margin-bottom: var(--space-8);
  }

  .muted {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    margin: 0;
  }

  .legend {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    margin: 0;
  }

  .new-badge {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    margin-left: var(--space-1);
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: white;
    letter-spacing: 0.1em;
    vertical-align: middle;
  }

  .summary-markdown {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    line-height: 1.6;
  }

  .summary-markdown :global(h1),
  .summary-markdown :global(h2),
  .summary-markdown :global(h3) {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
    margin: var(--space-3) 0 var(--space-2);
  }

  .summary-markdown :global(p),
  .summary-markdown :global(ul),
  .summary-markdown :global(ol) {
    margin: 0 0 var(--space-2);
  }

  .summary-markdown :global(ul),
  .summary-markdown :global(ol) {
    padding-left: var(--space-5);
  }

  .summary-markdown :global(:first-child) {
    margin-top: 0;
  }

  .summary-markdown :global(:last-child) {
    margin-bottom: 0;
  }

  .session {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .session-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .session-name-input {
    flex: 1;
    min-width: 10rem;
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
  }

  .day-select {
    width: 7rem;
  }

  .exercise-list {
    display: flex;
    flex-direction: column;
  }

  .exercise-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-top: 0.5px solid var(--border);
    flex-wrap: wrap;
  }

  .exercise-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 12rem;
  }

  .exercise-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
  }

  .exercise-meta {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
  }

  .exercise-note {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .exercise-targets {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }

  .target {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .target-label {
    font-family: var(--font-body);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .target-input {
    width: 3.5rem;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--ink-faint);
    font-size: var(--text-lg);
    line-height: 1;
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .remove-btn:hover {
    color: var(--accent-red);
  }

  .request-list {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
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
</style>
