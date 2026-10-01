import { getJourneysCollection, getTrainerGuidanceCollection } from "$lib/server/collections"
import { todayStr } from "$lib/server/dates"
import { buildGuidanceContext } from "$lib/server/guidance"
import { getTrainerApiKey, getTrainerKeyStatus, resolveTrainerSettings } from "$lib/server/trainer"
import { GUIDANCE_KICKOFF_PROMPT, GUIDANCE_SYSTEM_PROMPT } from "$lib/trainer"
import { json } from "@sveltejs/kit"
import { MongoServerError, ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

/** Lists a journey's guidance sessions, newest first. */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = url.searchParams.get("journeyId")
  if (!journeyId || !ObjectId.isValid(journeyId)) {
    return json({ error: "journeyId is required" }, { status: 400 })
  }

  const userId = new ObjectId(locals.userId)
  const today = todayStr(locals.userTimezone ?? "America/Los_Angeles")
  const col = await getTrainerGuidanceCollection()
  const [docs, keyStatus] = await Promise.all([
    col
      .find({ userId, journeyId: new ObjectId(journeyId) }, { projection: { date: 1, requestedAt: 1, model: 1 } })
      .sort({ date: -1 })
      .toArray(),
    getTrainerKeyStatus(userId),
  ])

  return json({
    guidance: docs.map((d) => ({
      id: d._id.toString(),
      date: d.date,
      requestedAt: d.requestedAt instanceof Date ? d.requestedAt.toISOString() : d.requestedAt,
      model: d.model,
    })),
    todayId: docs.find((d) => d.date === today)?._id.toString() ?? null,
    hasApiKey: keyStatus.hasKey,
  })
}

/**
 * Creates today's guidance record with a frozen snapshot of the journey (or returns today's
 * existing one). The reply itself is streamed by POST /api/guidance/[guidanceId].
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (typeof body.journeyId !== "string" || !ObjectId.isValid(body.journeyId)) {
    return json({ error: "journeyId is required" }, { status: 400 })
  }

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(body.journeyId)
  const tz = locals.userTimezone ?? "America/Los_Angeles"
  const today = todayStr(tz)

  const col = await getTrainerGuidanceCollection()
  const existing = await col.findOne({ userId, journeyId, date: today }, { projection: { _id: 1 } })
  if (existing) return json({ id: existing._id.toString() })

  if (!(await getTrainerApiKey(userId))) {
    return json({ error: "Add your Anthropic API key in Journey Settings → Trainer to get guidance." }, { status: 403 })
  }

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  const contextSnapshot = await buildGuidanceContext(userId, journey, tz, today)
  const now = new Date()
  try {
    const { insertedId } = await col.insertOne({
      userId,
      journeyId,
      date: today,
      requestedAt: now,
      model: resolveTrainerSettings(journey).model,
      systemPrompt: GUIDANCE_SYSTEM_PROMPT,
      kickoffPrompt: GUIDANCE_KICKOFF_PROMPT,
      contextSnapshot,
      messages: [],
      createdAt: now,
      updatedAt: now,
    })
    return json({ id: insertedId.toString() }, { status: 201 })
  } catch (err) {
    // Two "Get Guidance" clicks raced; return the one that won
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err
    const winner = await col.findOne({ userId, journeyId, date: today }, { projection: { _id: 1 } })
    return json({ id: winner!._id.toString() })
  }
}
