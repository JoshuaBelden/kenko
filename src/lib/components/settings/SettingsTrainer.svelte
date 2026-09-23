<script lang="ts">
  import { Card } from "$lib/components"
  import { DEFAULT_KICKOFF_PROMPT, DEFAULT_SYSTEM_PROMPT, TRAINER_MODELS, TRAINER_PROMPT_MAX_LENGTH } from "$lib/trainer"

  interface Props {
    trainerKey: { hasKey: boolean; last4: string | null }
    trainerApiKeyDraft: string
    trainerModel: string
    trainerSystemPrompt: string
    trainerKickoffPrompt: string
    onchange: (field: string, value: any) => void
    onremovekey: () => Promise<void>
  }

  let {
    trainerKey, trainerApiKeyDraft, trainerModel, trainerSystemPrompt, trainerKickoffPrompt, onchange, onremovekey,
  }: Props = $props()

  let confirmingRemove = $state(false)
  let removing = $state(false)

  const selectedModel = $derived(TRAINER_MODELS.find((m) => m.id === trainerModel))

  async function removeKey() {
    removing = true
    await onremovekey()
    removing = false
    confirmingRemove = false
  }
</script>

<Card>
  <h3 class="card-title">Trainer — API key</h3>
  <p class="help-text">
    Your trainer runs on Claude using your own Anthropic API key, so usage is billed to your Anthropic account.
    Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>.
    A Claude.ai subscription doesn't include API access; the Console needs its own billing set up.
  </p>
  <div class="settings-fields">
    {#if trainerKey.hasKey}
      <div class="key-status">
        <span class="key-saved">Key saved · ending in {trainerKey.last4}</span>
        {#if confirmingRemove}
          <span class="key-confirm">Remove key?</span>
          <button class="btn-danger-inline" onclick={removeKey} disabled={removing}>{removing ? "Removing…" : "Yes"}</button>
          <button class="btn-text" onclick={() => (confirmingRemove = false)}>No</button>
        {:else}
          <button class="btn-text btn-danger-text" onclick={() => (confirmingRemove = true)}>Remove key</button>
        {/if}
      </div>
    {/if}
    <div class="field">
      <label class="field-label" for="s-trainer-key">{trainerKey.hasKey ? "Replace API key" : "Anthropic API key"}</label>
      <input
        id="s-trainer-key"
        type="password"
        autocomplete="off"
        spellcheck="false"
        value={trainerApiKeyDraft}
        oninput={(e) => onchange("trainerApiKeyDraft", e.currentTarget.value)}
        placeholder="sk-ant-..."
      />
      <span class="field-hint">Checked with Anthropic and stored encrypted when you save settings. It is never shown again.</span>
    </div>
  </div>
</Card>

<Card>
  <h3 class="card-title">Trainer — Model</h3>
  <div class="settings-fields">
    <div class="field">
      <label class="field-label" for="s-trainer-model">Model</label>
      <select id="s-trainer-model" value={trainerModel} onchange={(e) => onchange("trainerModel", e.currentTarget.value)}>
        {#each TRAINER_MODELS as m}
          <option value={m.id}>{m.label}</option>
        {/each}
      </select>
      {#if selectedModel}
        <span class="field-hint">{selectedModel.note}. Changes apply from your next day's session.</span>
      {/if}
    </div>
  </div>
</Card>

<Card>
  <h3 class="card-title">Trainer — Prompts</h3>
  <p class="help-text">Your journey goals, progress and journal notes are attached automatically. These prompts control your trainer's tone and focus.</p>
  <div class="settings-fields">
    <div class="field">
      <label class="field-label" for="s-trainer-system">Trainer persona</label>
      <textarea
        id="s-trainer-system"
        rows="12"
        maxlength={TRAINER_PROMPT_MAX_LENGTH}
        value={trainerSystemPrompt}
        oninput={(e) => onchange("trainerSystemPrompt", e.currentTarget.value)}
      ></textarea>
      {#if trainerSystemPrompt.trim() !== DEFAULT_SYSTEM_PROMPT.trim()}
        <button class="btn-link" onclick={() => onchange("trainerSystemPrompt", DEFAULT_SYSTEM_PROMPT)}>Reset to default</button>
      {/if}
    </div>
    <div class="field">
      <label class="field-label" for="s-trainer-kickoff">Today's Recommendations prompt</label>
      <textarea
        id="s-trainer-kickoff"
        rows="4"
        maxlength={TRAINER_PROMPT_MAX_LENGTH}
        value={trainerKickoffPrompt}
        oninput={(e) => onchange("trainerKickoffPrompt", e.currentTarget.value)}
      ></textarea>
      {#if trainerKickoffPrompt.trim() !== DEFAULT_KICKOFF_PROMPT.trim()}
        <button class="btn-link" onclick={() => onchange("trainerKickoffPrompt", DEFAULT_KICKOFF_PROMPT)}>Reset to default</button>
      {/if}
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

  .help-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0 0 var(--space-4) 0;
    line-height: 1.5;
  }

  .help-text a {
    color: var(--accent);
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

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field-hint {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
  }

  .field input,
  .field select,
  .field textarea {
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

  .field textarea {
    font-size: var(--text-sm);
    line-height: 1.5;
    resize: vertical;
  }

  .field select {
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0 center;
    padding-right: var(--space-5);
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-bottom-color: var(--border-strong);
  }

  .field input::placeholder {
    color: var(--ink-faint);
  }

  .key-status {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .key-saved {
    color: var(--accent-green);
    font-weight: 500;
  }

  .key-confirm {
    color: var(--ink-light);
  }

  .btn-link {
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    text-decoration: underline;
  }

  .btn-text,
  .btn-danger-inline {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    padding: var(--space-1) var(--space-2);
  }

  .btn-danger-text,
  .btn-danger-inline {
    color: var(--accent-red);
  }

  .btn-danger-inline {
    font-weight: 500;
  }
</style>
