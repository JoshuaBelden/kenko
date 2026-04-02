import { getWorkoutLogsCollection, serializeWorkoutLog } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!Array.isArray(body.sets)) return json({ error: "sets array is required" }, { status: 400 })

  const sets = body.sets.map((s: any) => ({
    _id: s.id ? new ObjectId(s.id) : new ObjectId(),
    exerciseId: new ObjectId(s.exerciseId),
    setNumber: s.setNumber ?? 1,
    weight: s.weight ?? 0,
    reps: s.reps ?? 0,
    rpe: s.rpe ?? null,
    isAdditional: s.isAdditional ?? false,
  }))

  const logs = await getWorkoutLogsCollection()
  const result = await logs.findOneAndUpdate(
    {
      _id: new ObjectId(params.id),
      userId: new ObjectId(locals.userId),
      status: "in_progress",
    },
    { $set: { sets, updatedAt: new Date() } },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Log not found or already completed" }, { status: 404 })
  return json(serializeWorkoutLog(result))
}
