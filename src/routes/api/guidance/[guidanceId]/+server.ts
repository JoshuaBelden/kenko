import { getTrainerGuidanceCollection } from "$lib/server/collections"
import { todayStr } from "$lib/server/dates"
import {
  MAX_USER_MESSAGES_PER_DAY,
  getTrainerApiKey,
  streamTrainerResponse,
  type TrainerChatState,
} from "$lib/server/trainer"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const MAX_MESSAGE_LENGTH = 4000

/**
 * Streams the initial guidance (no message, only while the record has no reply yet) or answers
 * a follow-up (message). Follow-ups are only allowed on the day the guidance was requested.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })
  if (!ObjectId.isValid(params.guidanceId)) return json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const userId = new ObjectId(locals.userId)
  const guidanceId = new ObjectId(params.guidanceId)
  const today = todayStr(locals.userTimezone ?? "America/Los_Angeles")

  const col = await getTrainerGuidanceCollection()
  const doc = await col.findOne({ _id: guidanceId, userId })
  if (!doc) return json({ error: "Not found" }, { status: 404 })
  if (doc.date !== today) {
    return json({ error: "This guidance is read-only. Request new guidance from the Guidance tab." }, { status: 403 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` }, { status: 400 })
  }

  const history = (doc.messages ?? []).map((m: any) => ({ role: m.role, content: m.content }))
  const isKickoff = history.length === 0
  if (isKickoff && message) return json({ error: "Your guidance hasn't been generated yet." }, { status: 400 })
  if (!isKickoff && !message) return json({ error: "message is required" }, { status: 400 })
  if (history.filter((m: any) => m.role === "user").length >= MAX_USER_MESSAGES_PER_DAY) {
    return json({ error: "You've reached the question limit for this guidance." }, { status: 429 })
  }

  const apiKey = await getTrainerApiKey(userId)
  if (!apiKey) {
    return json({ error: "Add your Anthropic API key in Journey Settings → Trainer to get guidance." }, { status: 403 })
  }

  const chat: TrainerChatState = {
    model: doc.model,
    systemPrompt: doc.systemPrompt,
    kickoffPrompt: doc.kickoffPrompt,
    contextSnapshot: doc.contextSnapshot,
    messages: message ? [...history, { role: "user", content: message }] : history,
  }

  return streamTrainerResponse(
    chat,
    apiKey,
    async (reply) => {
      const now = new Date()
      const assistantMessage = { role: "assistant", content: reply, at: now }
      if (isKickoff) {
        // Only the first kickoff to finish is kept (e.g. the page was open in two tabs)
        await col.updateOne(
          { _id: guidanceId, messages: { $size: 0 } },
          { $push: { messages: assistantMessage }, $set: { updatedAt: now } } as any,
        )
      } else {
        await col.updateOne(
          { _id: guidanceId },
          {
            $push: { messages: { $each: [{ role: "user", content: message, at: now }, assistantMessage] } },
            $set: { updatedAt: now },
          } as any,
        )
      }
    },
    { effort: "high", logTag: "guidance" },
  )
}
