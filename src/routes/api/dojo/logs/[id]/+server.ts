import { CARDIO_TYPES, getWorkoutLogsCollection, serializeWorkoutLog } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const logs = await getWorkoutLogsCollection()
  const log = await logs.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!log) return json({ error: "Not found" }, { status: 404 })
  return json(serializeWorkoutLog(log))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.startedAt) updates.startedAt = new Date(body.startedAt)
  if (body.completedAt) updates.completedAt = new Date(body.completedAt)
  if (body.caloriesBurned !== undefined) updates.caloriesBurned = body.caloriesBurned
  if (body.cardioDistance !== undefined) updates.cardioDistance = body.cardioDistance

  if (body.cardioType !== undefined) {
    if (body.cardioType !== null && !CARDIO_TYPES.includes(body.cardioType)) {
      return json({ error: "Invalid cardioType" }, { status: 400 })
    }
    updates.cardioType = body.cardioType
  }

  if (body.rpe !== undefined) {
    if (body.rpe === null) {
      updates.rpe = null
    } else {
      const rpeNum = Number(body.rpe)
      if (!Number.isInteger(rpeNum) || rpeNum < 1 || rpeNum > 10) {
        return json({ error: "rpe must be an integer 1-10" }, { status: 400 })
      }
      updates.rpe = rpeNum
    }
  }

  if (Object.keys(updates).length <= 1) {
    return json({ error: "No valid fields to update" }, { status: 400 })
  }

  const logs = await getWorkoutLogsCollection()
  const result = await logs.findOneAndUpdate(
    {
      _id: new ObjectId(params.id),
      userId: new ObjectId(locals.userId),
    },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeWorkoutLog(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const logs = await getWorkoutLogsCollection()
  const result = await logs.deleteOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (result.deletedCount === 0) return json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
