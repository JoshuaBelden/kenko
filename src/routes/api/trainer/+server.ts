import { getJourneysCollection, getTrainerChatsCollection } from "$lib/server/collections"
import { todayStr } from "$lib/server/dates"
import {
  MAX_USER_MESSAGES_PER_DAY,
  buildTrainerContext,
  getTrainerApiKey,
  getTrainerKeyStatus,
  resolveTrainerSettings,
  serializeTrainerChat,
  streamTrainerResponse,
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

  return streamTrainerResponse(chat, apiKey, (reply) =>
    saveTurn(userId, journeyId, today, chat, existing !== null, message, reply),
  )
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
