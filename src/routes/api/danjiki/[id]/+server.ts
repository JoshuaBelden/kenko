import { getFastsCollection, serializeFast } from "$lib/server/danjiki"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const fasts = await getFastsCollection()
  const fast = await fasts.findOne({ _id: new ObjectId(params.id), userId })

  if (!fast) return json({ error: "Not found" }, { status: 404 })
  return json(serializeFast(fast))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const fasts = await getFastsCollection()
  const fast = await fasts.findOne({ _id: new ObjectId(params.id), userId })

  if (!fast) return json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // actualDuration can only be edited on completed fasts
  if (body.actualDuration !== undefined) {
    if (fast.status !== "completed") {
      return json({ error: "actualDuration can only be edited on completed fasts" }, { status: 400 })
    }
    if (typeof body.actualDuration !== "number" || body.actualDuration < 0) {
      return json({ error: "actualDuration must be a non-negative number" }, { status: 400 })
    }
    updates.actualDuration = body.actualDuration
  }

  // note can be edited on any fast
  if (body.note !== undefined) {
    updates.note = body.note?.trim() || null
  }

  const result = await fasts.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeFast(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const fasts = await getFastsCollection()
  const result = await fasts.deleteOne({ _id: new ObjectId(params.id), userId })

  if (result.deletedCount === 0) return json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
