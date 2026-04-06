import { getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name?.trim()) return json({ error: "session name is required" }, { status: 400 })

  const session = {
    _id: new ObjectId(),
    name: body.name.trim(),
    type: body.type === "cardio" ? "cardio" : "strength",
    targetDayOfWeek: body.targetDayOfWeek ?? null,
    exercises: (body.exercises ?? []).map((e: any, i: number) => ({
      _id: new ObjectId(),
      exerciseId: new ObjectId(e.exerciseId),
      order: e.order ?? i,
      targetSets: e.targetSets ?? 3,
      targetReps: e.targetReps ?? 10,
      targetWeight: e.targetWeight ?? null,
      restSeconds: e.restSeconds ?? 90,
    })),
  }

  const plans = await getWorkoutPlansCollection()
  const result = await plans.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
    { $push: { sessions: session as any }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Plan not found" }, { status: 404 })
  return json(serializeWorkoutPlan(result), { status: 201 })
}
