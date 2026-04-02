import { getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates["sessions.$.name"] = body.name.trim()
  if (body.targetDayOfWeek !== undefined) updates["sessions.$.targetDayOfWeek"] = body.targetDayOfWeek
  if (body.exercises !== undefined) {
    updates["sessions.$.exercises"] = body.exercises.map((e: any, i: number) => ({
      _id: e.id ? new ObjectId(e.id) : new ObjectId(),
      exerciseId: new ObjectId(e.exerciseId),
      order: e.order ?? i,
      targetSets: e.targetSets ?? 3,
      targetReps: e.targetReps ?? 10,
      targetWeight: e.targetWeight ?? null,
      restSeconds: e.restSeconds ?? 90,
    }))
  }

  const plans = await getWorkoutPlansCollection()
  const result = await plans.findOneAndUpdate(
    {
      _id: new ObjectId(params.id),
      userId: new ObjectId(locals.userId),
      "sessions._id": new ObjectId(params.sessionId),
    },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Plan or session not found" }, { status: 404 })
  return json(serializeWorkoutPlan(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const plans = await getWorkoutPlansCollection()
  const result = await plans.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
    {
      $pull: { sessions: { _id: new ObjectId(params.sessionId) } as any },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Plan not found" }, { status: 404 })
  return json(serializeWorkoutPlan(result))
}
