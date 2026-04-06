import { getWorkoutLogsCollection, serializeWorkoutLog } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const now = new Date()

  const updates: Record<string, unknown> = {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  }

  if (body.notes !== undefined) updates.notes = body.notes
  if (body.caloriesBurned !== undefined) updates.caloriesBurned = body.caloriesBurned
  if (body.cardioDistance !== undefined) updates.cardioDistance = body.cardioDistance

  const logs = await getWorkoutLogsCollection()
  const result = await logs.findOneAndUpdate(
    {
      _id: new ObjectId(params.id),
      userId: new ObjectId(locals.userId),
      status: "in_progress",
    },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Log not found or already completed" }, { status: 404 })
  return json(serializeWorkoutLog(result))
}
