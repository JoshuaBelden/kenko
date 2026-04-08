<script lang="ts">
  import { Card, TipTapEditor } from "$lib/components"

  interface Props {
    name: string
    description: string
    statement: string | null
    startDate: string
    startTime: string
    endDate: string
    endTime: string
    onchange: (field: string, value: any) => void
  }

  let { name, description, statement, startDate, startTime, endDate, endTime, onchange }: Props = $props()
</script>

<Card>
  <h3 class="card-title">General</h3>
  <div class="settings-fields">
    <div class="field">
      <label class="field-label" for="s-name">Journey name</label>
      <input id="s-name" value={name} oninput={(e) => onchange("name", e.currentTarget.value)} placeholder="Journey name" />
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label" for="s-start">Start date</label>
        <input id="s-start" type="date" value={startDate} oninput={(e) => onchange("startDate", e.currentTarget.value)} />
      </div>
      <div class="field">
        <label class="field-label" for="s-start-time">Start time</label>
        <input id="s-start-time" type="time" value={startTime} oninput={(e) => onchange("startTime", e.currentTarget.value)} />
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label" for="s-end">End date</label>
        <input id="s-end" type="date" value={endDate} oninput={(e) => onchange("endDate", e.currentTarget.value)} />
      </div>
      <div class="field">
        <label class="field-label" for="s-end-time">End time</label>
        <input id="s-end-time" type="time" value={endTime} oninput={(e) => onchange("endTime", e.currentTarget.value)} />
      </div>
    </div>
    <div class="field">
      <label class="field-label" for="s-desc">Description</label>
      <input id="s-desc" value={description} oninput={(e) => onchange("description", e.currentTarget.value)} placeholder="Optional description" />
    </div>
    <div class="field">
      <span class="field-label">Why this journey matters</span>
      <TipTapEditor
        content={statement}
        onblur={(html) => { onchange("statement", html) }}
        placeholder="What drives this journey..."
      />
    </div>
  </div>
</Card>

<style>
  .card-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0 0 var(--space-4) 0;
  }

  .settings-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-row {
    display: flex;
    gap: var(--space-4);
  }

  .field-row .field {
    flex: 1;
  }

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field input {
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

  .field input:focus {
    border-bottom-color: var(--border-strong);
  }

  .field input::placeholder {
    color: var(--ink-faint);
  }
</style>
