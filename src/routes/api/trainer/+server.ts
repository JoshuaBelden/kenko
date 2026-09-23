import Anthropic from "@anthropic-ai/sdk"
import { dev } from "$app/environment"
import { getJourneysCollection, getTrainerChatsCollection } from "$lib/server/collections"
import { todayStr } from "$lib/server/dates"
import {
  MAX_USER_MESSAGES_PER_DAY,
  buildTrainerContext,
  getTrainerApiKey,
  getTrainerKeyStatus,
  resolveTrainerSettings,
  serializeTrainerChat,
  streamTrainerReply,
  type TrainerChatState,
} from "$lib/server/trainer"
import { json } from "@sveltejs/kit"
import { MongoServerError, ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_MESSAGE_LENGTH = 4000

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = url.searchParams.get("journeyId")
  const date = url.searchParams.get("date")
  if (!journeyId || !ObjectId.isValid(journeyId) || !date || !DATE_RE.test(date)) {
    return json({ error: "journeyId and date are required" }, { status: 400 })
  }

  const userId = new ObjectId(locals.userId)
  const chats = await getTrainerChatsCollection()
  const [chat, keyStatus] = await Promise.all([
    chats.findOne({ userId, journeyId: new ObjectId(journeyId), date }),
    getTrainerKeyStatus(userId),
  ])
  return json({ chat: chat ? serializeTrainerChat(chat) : null, hasApiKey: keyStatus.hasKey })
}

/** Clears today's chat so the next "Today's Recommendations" rebuilds the context from the latest data. */
export const DELETE: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = url.searchParams.get("journeyId")
  const date = url.searchParams.get("date")
  if (!journeyId || !ObjectId.isValid(journeyId)) {
    return json({ error: "journeyId is required" }, { status: 400 })
  }
  if (date !== todayStr(locals.userTimezone ?? "America/Los_Angeles")) {
    return json({ error: "Only today's conversation can be cleared." }, { status: 403 })
  }

  const chats = await getTrainerChatsCollection()
  await chats.deleteOne({ userId: new ObjectId(locals.userId), journeyId: new ObjectId(journeyId), date })
  return new Response(null, { status: 204 })
}

/**
 * Starts today's trainer chat (no message) or asks a follow-up (message).
 * Streams the assistant's reply as plain text and saves the turn once it completes.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const userId = new ObjectId(locals.userId)
  const tz = locals.userTimezone ?? "America/Los_Angeles"
  const today = todayStr(tz)

  if (typeof body.journeyId !== "string" || !ObjectId.isValid(body.journeyId)) {
    return json({ error: "journeyId is required" }, { status: 400 })
  }
  if (body.date !== today) {
    return json({ error: "The trainer is only available for today's journal." }, { status: 403 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` }, { status: 400 })
  }

  const apiKey = await getTrainerApiKey(userId)
  if (!apiKey) {
    return json({ error: "Add your Anthropic API key in Journey Settings → Trainer to use your trainer." }, { status: 403 })
  }

  const journeyId = new ObjectId(body.journeyId)
  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  const chats = await getTrainerChatsCollection()
  const existing = await chats.findOne({ userId, journeyId, date: today })

  let chat: TrainerChatState
  if (existing) {
    if (!message) return json({ error: "message is required" }, { status: 400 })
    const userMessageCount = (existing.messages ?? []).filter((m: any) => m.role === "user").length
    if (userMessageCount >= MAX_USER_MESSAGES_PER_DAY) {
      return json({ error: "You've reached today's limit for trainer questions. See you tomorrow!" }, { status: 429 })
    }
    chat = {
      model: existing.model,
      systemPrompt: existing.systemPrompt,
      kickoffPrompt: existing.kickoffPrompt,
      contextSnapshot: existing.contextSnapshot,
      messages: [
        ...(existing.messages ?? []).map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    }
  } else {
    if (message) return json({ error: "Start with Today's Recommendations first." }, { status: 400 })
    const settings = resolveTrainerSettings(journey)
    chat = {
      ...settings,
      contextSnapshot: await buildTrainerContext(userId, journey, tz, today),
      messages: [],
    }
  }

  let stream: ReturnType<typeof streamTrainerReply>
  let iterator: AsyncIterator<Anthropic.Beta.BetaRawMessageStreamEvent>
  let first: IteratorResult<Anthropic.Beta.BetaRawMessageStreamEvent>
  try {
    stream = streamTrainerReply(chat, apiKey)
    iterator = stream[Symbol.asyncIterator]()
    // Wait for the first event so auth/rate-limit/config errors return a proper status instead of a broken stream
    first = await iterator.next()
  } catch (err) {
    return trainerErrorResponse(err)
  }

  const encoder = new TextEncoder()
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let event = first
        while (!event.done) {
          const e = event.value
          if (e.type === "content_block_delta" && e.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(e.delta.text))
          }
          event = await iterator.next()
        }

        const final = await stream.finalMessage()
        let reply = final.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")

        if (final.stop_reason === "refusal") {
          const note = "I'm not able to help with that one. Let's get back to your journey — what else can I help you with today?"
          const suffix = reply ? `\n\n${note}` : note
          reply += suffix
          controller.enqueue(encoder.encode(suffix))
        } else if (final.stop_reason === "max_tokens") {
          reply += "…"
          controller.enqueue(encoder.encode("…"))
        }

        if (dev) {
          const u = final.usage
          console.log(
            `[trainer] ${final.model} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
          )
        }

        await saveTurn(userId, journeyId, today, chat, existing !== null, message, reply)
        controller.close()
      } catch (err) {
        console.error("[trainer] stream failed", err)
        controller.error(err)
      }
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(body$, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

async function saveTurn(
  userId: ObjectId,
  journeyId: ObjectId,
  date: string,
  chat: TrainerChatState,
  chatExists: boolean,
  message: string,
  reply: string,
) {
  const chats = await getTrainerChatsCollection()
  const now = new Date()
  const assistantMessage = { role: "assistant", content: reply, at: now }

  if (chatExists) {
    await chats.updateOne(
      { userId, journeyId, date },
      {
        $push: { messages: { $each: [{ role: "user", content: message, at: now }, assistantMessage] } },
        $set: { updatedAt: now },
      } as any,
    )
    return
  }

  try {
    await chats.insertOne({
      userId,
      journeyId,
      date,
      model: chat.model,
      systemPrompt: chat.systemPrompt,
      kickoffPrompt: chat.kickoffPrompt,
      contextSnapshot: chat.contextSnapshot,
      messages: [assistantMessage],
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    // Two "Today's Recommendations" clicks raced; keep the first chat
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err
  }
}

function trainerErrorResponse(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return json(
      { error: "Anthropic rejected your API key. Update it in Journey Settings → Trainer." },
      { status: 403 },
    )
  }
  if (err instanceof Anthropic.RateLimitError) {
    return json(
      { error: "Your Anthropic account hit a rate or spend limit. Try again in a minute, or check your Anthropic Console billing." },
      { status: 429 },
    )
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`[trainer] API error ${err.status}`, err.message)
    return json({ error: "The trainer couldn't respond. Please try again." }, { status: 502 })
  }
  console.error("[trainer] unexpected error", err)
  return json({ error: "The trainer couldn't respond. Please try again." }, { status: 500 })
}
