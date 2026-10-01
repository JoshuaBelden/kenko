<script lang="ts">
  import { page } from "$app/state"
  import { Button, Card, ChatThread } from "$lib/components"
  import { formatDate } from "$lib/format"
  import { postTrainerStream, type ChatMessage } from "$lib/trainer"
  import { onMount } from "svelte"

  const data = $derived(page.data as any)
  const tz = $derived(page.data.user?.profile?.timezone ?? "America/Los_Angeles")
  const journey = $derived(data.journey)
  const guidance = $derived(data.guidance)
  const canAsk = $derived(data.canAsk && data.hasApiKey)

  const toMessages = (g: any): ChatMessage[] => g.messages.map((m: any) => ({ role: m.role, content: m.content }))

  let messages = $state<ChatMessage[]>(toMessages(page.data.guidance))
  let streaming = $state(false)
  let error = $state("")
  let draft = $state("")

  // Navigating between guidance records reuses this component
  let shownId = page.data.guidance.id
  $effect.pre(() => {
    if (guidance.id !== shownId) {
      shownId = guidance.id
      messages = toMessages(guidance)
      error = ""
      draft = ""
    }
  })

  const awaitingKickoff = $derived(messages.length === 0 && !streaming)

  onMount(() => {
    if (messages.length === 0 && canAsk) send()
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
      await postTrainerStream(`/api/guidance/${guidance.id}`, { message }, (chunk) => {
        messages[replyIndex].content += chunk
      })
    } catch (err) {
      messages = previous
      if (message) draft = message
      error = err instanceof Error && err.message ? err.message : "The trainer couldn't respond. Please try again."
    } finally {
      streaming = false
    }
  }
</script>

<a href={`/tabi/${journey.id}?tab=guidance`} class="back-link">&larr; {journey.name}</a>
<div class="guidance-header">
  <h1 class="guidance-title">Guidance</h1>
  <p class="guidance-date">{formatDate(guidance.requestedAt, tz)}</p>
</div>

<div class="guidance">
  {#if messages.length > 0}
    <ChatThread
      {messages}
      {streaming}
      model={guidance.model}
      {canAsk}
      placeholder="Ask your trainer about this guidance…"
      bind:draft
      onsend={(message) => send(message)}
    />
  {/if}

  {#if awaitingKickoff}
    <Card>
      <div class="guidance-empty">
        {#if canAsk}
          <p class="guidance-muted">Your guidance hasn't been generated yet.</p>
          <Button onclick={() => send()}>Generate Guidance</Button>
        {:else if data.canAsk}
          <p class="guidance-muted">Add your Anthropic API key in <strong>Journey Settings → Trainer</strong> to generate guidance.</p>
        {:else}
          <p class="guidance-muted">This guidance was never generated.</p>
        {/if}
      </div>
    </Card>
  {/if}

  {#if !data.canAsk && messages.length > 0}
    <p class="guidance-muted">This guidance is read-only. Request new guidance from the Guidance tab.</p>
  {/if}

  {#if error}
    <p class="guidance-error">{error}</p>
  {/if}
</div>

<style>
  .back-link {
    display: inline-block;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-decoration: none;
    margin-bottom: var(--space-2);
    transition: color var(--transition-fast);
  }

  .back-link:hover {
    color: var(--ink);
  }

  .guidance-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-6);
  }

  .guidance-title {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .guidance-date,
  .guidance-muted {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .guidance {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .guidance-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .guidance-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-red);
    margin: 0;
  }
</style>
