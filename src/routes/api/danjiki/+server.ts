import { getFastsCollection, serializeFast } from "$lib/server/danjiki"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const fasts = await getFastsCollection()

  // Running fast always first, then sorted by startedAt desc
  const list = await fasts
    .find({ userId })
    .sort({ status: 1, startedAt: -1 })
    .toArray()

  return json(list.map(serializeFast))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const body = await request.json()

  if (typeof body.targetDuration !== "number" || body.targetDuration <= 0) {
    return json({ error: "targetDuration must be a positive number (hours)" }, { status: 400 })
  }

  const fasts = await getFastsCollection()

  // Reject if a running fast already exists
  const running = await fasts.findOne({ userId, status: "running" })
  if (running) {
    return json({ error: "A fast is already running. End it before starting a new one." }, { status: 409 })
  }

  const now = new Date()
  const result = await fasts.insertOne({
    userId,
    journeyIds: [],
    targetDuration: body.targetDuration,
    startedAt: now,
    endedAt: null,
    actualDuration: null,
    note: body.note?.trim() || null,
    status: "running",
    createdAt: now,
    updatedAt: now,
  })

  const created = await fasts.findOne({ _id: result.insertedId })
  return json(serializeFast(created!), { status: 201 })
}
