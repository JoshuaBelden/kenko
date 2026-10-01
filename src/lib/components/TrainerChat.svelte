<script lang="ts">
  import { postTrainerStream, type ChatMessage } from "$lib/trainer"
  import Button from "./Button.svelte"
  import Card from "./Card.svelte"
  import ChatThread from "./ChatThread.svelte"

  interface Props {
    journeyId: string
    date: string
    isToday: boolean
  }

  let { journeyId, date, isToday }: Props = $props()

  let messages = $state<ChatMessage[]>([])
  let model = $state<string | null>(null)
  let hasApiKey = $state(false)
  let loading = $state(true)
  let streaming = $state(false)
  let error = $state("")
  let draft = $state("")
  let confirmingClear = $state(false)
  let clearing = $state(false)

  const hasChat = $derived(messages.length > 0)

  async function loadChat(forJourney: string, forDate: string) {
    loading = true
    error = ""
    messages = []
    model = null
    confirmingClear = false
    try {
      const res = await fetch(`/api/trainer?journeyId=${forJourney}&date=${forDate}`)
      if (!res.ok) throw new Error()
      const { chat, hasApiKey: keySaved } = await res.json()
      if (forDate !== date) return // user switched days while loading
      messages = chat?.messages?.map((m: any) => ({ role: m.role, content: m.content })) ?? []
      model = chat?.model ?? null
      hasApiKey = keySaved
    } catch {
      error = "Couldn't load your trainer conversation."
    } finally {
      loading = false
    }
  }

  $effect(() => {
    loadChat(journeyId, date)
  })

  async function send(message?: string) {
    if (streaming) return
    error = ""
    streaming = true

    const previous = messages
    const next: ChatMessage[] = message ? [...messages, { role: "user", content: message }] : [...messages]
    next.push({ role: "assistant", content: "" })
    messages = next
    const replyIndex = next.length - 1

    try {
      await postTrainerStream("/api/trainer", { journeyId, date, message }, (chunk) => {
        messages[replyIndex].content += chunk
      })
      if (!model) {
        // First reply of the day: pick up which model answered
        const { chat } = await fetch(`/api/trainer?journeyId=${journeyId}&date=${date}`).then((r) => r.json())
        model = chat?.model ?? null
      }
    } catch (err) {
      messages = previous
      if (message) draft = message
      error = err instanceof Error && err.message ? err.message : "The trainer couldn't respond. Please try again."
    } finally {
      streaming = false
    }
  }

  async function clearConversation() {
    clearing = true
    error = ""
    try {
      const res = await fetch(`/api/trainer?journeyId=${journeyId}&date=${date}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Couldn't clear the conversation.")
      }
      messages = []
      model = null
      draft = ""
    } catch (err) {
      error = err instanceof Error ? err.message : "Couldn't clear the conversation."
    } finally {
      clearing = false
      confirmingClear = false
    }
  }
</script>

<div class="trainer">
  {#if loading}
    <p class="trainer-muted">Loading...</p>
  {:else if !hasApiKey && (isToday || !hasChat)}
    <Card>
      <div class="trainer-empty">
        <p class="trainer-intro">
          Your trainer needs an Anthropic API key first. Add one in <strong>Journey Settings → Trainer</strong> to get
          personalised recommendations for your day.
        </p>
        {#if hasChat}
          <p class="trainer-muted">Your earlier conversation from today is shown below.</p>
        {/if}
      </div>
    </Card>
  {:else if !hasChat}
    <Card>
      <div class="trainer-empty">
        {#if isToday}
          <p class="trainer-intro">
            Your trainer looks at your journey goals, how this week has gone and what you've written in your journal,
            then suggests a plan for today.
          </p>
          <Button onclick={() => send()} disabled={streaming}>Today's Recommendations</Button>
        {:else}
          <p class="trainer-muted">No trainer session this day.</p>
        {/if}
      </div>
    </Card>
  {/if}

  {#if hasChat}
    <ChatThread
      {messages}
      {streaming}
      {model}
      canAsk={isToday && hasApiKey}
      bind:draft
      onsend={(message) => send(message)}
    />

    {#if !isToday}
      <p class="trainer-muted">Follow-up questions are available on today's journal.</p>
    {/if}

    {#if isToday && !streaming}
      <div class="trainer-clear">
        {#if confirmingClear}
          <span class="trainer-muted">Clear today's conversation and start over with your latest data?</span>
          <button class="btn-danger-inline" onclick={clearConversation} disabled={clearing}>{clearing ? "Clearing…" : "Yes"}</button>
          <button class="btn-text" onclick={() => (confirmingClear = false)} disabled={clearing}>No</button>
        {:else}
          <button class="btn-text btn-danger-text" onclick={() => (confirmingClear = true)}>Clear conversation</button>
        {/if}
      </div>
    {/if}
  {/if}

  {#if error}
    <p class="trainer-error">{error}</p>
  {/if}
</div>

<style>
  .trainer {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .trainer-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .trainer-intro,
  .trainer-muted {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .trainer-clear {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
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

  .trainer-clear .btn-text:first-child {
    padding-left: 0;
  }

  .trainer-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-red);
    margin: 0;
  }
</style>
