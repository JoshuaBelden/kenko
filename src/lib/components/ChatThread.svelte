<script lang="ts">
  import { browser } from "$app/environment"
  import DOMPurify from "dompurify"
  import { marked } from "marked"
  import { trainerModelLabel, type ChatMessage } from "$lib/trainer"
  import Button from "./Button.svelte"

  interface Props {
    messages: ChatMessage[]
    streaming: boolean
    model: string | null
    /** Shows the follow-up form. */
    canAsk: boolean
    placeholder?: string
    draft?: string
    onsend: (message: string) => void
  }

  let {
    messages,
    streaming,
    model,
    canAsk,
    placeholder = "Ask your trainer a follow-up question…",
    draft = $bindable(""),
    onsend,
  }: Props = $props()

  function renderMarkdown(text: string): string {
    const html = marked.parse(text, { async: false, breaks: true })
    return browser ? DOMPurify.sanitize(html) : ""
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    const message = draft.trim()
    if (!message) return
    draft = ""
    onsend(message)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      ;(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit()
    }
  }
</script>

<div class="trainer-messages">
  {#each messages as m, i}
    {#if m.role === "assistant"}
      <div class="msg msg-assistant">
        {#if m.content}
          <div class="msg-markdown">{@html renderMarkdown(m.content)}</div>
        {:else if streaming && i === messages.length - 1}
          <span class="typing" aria-label="Trainer is thinking"><span></span><span></span><span></span></span>
        {/if}
      </div>
    {:else}
      <div class="msg msg-user">{m.content}</div>
    {/if}
  {/each}
</div>

{#if model}
  <p class="trainer-model">Coached by {trainerModelLabel(model)}</p>
{/if}

{#if canAsk}
  <form class="trainer-form" onsubmit={submit}>
    <textarea
      class="trainer-input"
      rows="2"
      {placeholder}
      bind:value={draft}
      onkeydown={onKeydown}
      disabled={streaming}
    ></textarea>
    <div class="trainer-actions">
      <Button type="submit" disabled={streaming || !draft.trim()}>{streaming ? "Thinking…" : "Send"}</Button>
    </div>
  </form>
{/if}

<style>
  .trainer-messages {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .msg {
    font-family: var(--font-body);
    font-size: var(--text-base);
    line-height: 1.6;
    color: var(--ink);
  }

  .msg-assistant {
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-5) var(--space-6);
  }

  .msg-user {
    align-self: flex-end;
    max-width: 85%;
    background: var(--accent-soft);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    white-space: pre-wrap;
  }

  .msg-markdown :global(h1),
  .msg-markdown :global(h2),
  .msg-markdown :global(h3) {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    margin: var(--space-4) 0 var(--space-2);
  }

  .msg-markdown :global(:first-child) {
    margin-top: 0;
  }

  .msg-markdown :global(:last-child) {
    margin-bottom: 0;
  }

  .msg-markdown :global(p),
  .msg-markdown :global(ul),
  .msg-markdown :global(ol) {
    margin: 0 0 var(--space-3);
  }

  .msg-markdown :global(ul),
  .msg-markdown :global(ol) {
    padding-left: var(--space-5);
  }

  .msg-markdown :global(li) {
    margin-bottom: var(--space-1);
  }

  .msg-markdown :global(table) {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
  }

  .msg-markdown :global(th),
  .msg-markdown :global(td) {
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
    text-align: left;
    vertical-align: top;
  }

  .msg-markdown :global(th) {
    font-weight: 500;
    color: var(--ink-light);
  }

  .typing {
    display: inline-flex;
    gap: var(--space-1);
  }

  .typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-faint);
    animation: typing-bounce 1.2s infinite ease-in-out;
  }

  .typing span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .typing span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes typing-bounce {
    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }

  .trainer-model {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    margin: 0;
  }

  .trainer-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .trainer-input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    resize: vertical;
    transition: border-color var(--transition-fast);
  }

  .trainer-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .trainer-input::placeholder {
    color: var(--ink-faint);
  }

  .trainer-actions {
    display: flex;
    justify-content: flex-start;
  }
</style>
