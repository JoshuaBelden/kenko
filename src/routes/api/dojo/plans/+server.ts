import { getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const plans = await getWorkoutPlansCollection()
  const list = await plans
    .find({ userId: new ObjectId(locals.userId) })
    .sort({ createdAt: -1 })
    .toArray()

  return json(list.map(serializeWorkoutPlan))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name?.trim()) return json({ error: "name is required" }, { status: 400 })

  const sessions = (body.sessions ?? []).map((s: any) => ({
    _id: new ObjectId(),
    name: s.name ?? "Session",
    targetDayOfWeek: s.targetDayOfWeek ?? null,
    exercises: (s.exercises ?? []).map((e: any, i: number) => ({
      _id: new ObjectId(),
      exerciseId: new ObjectId(e.exerciseId),
      order: e.order ?? i,
      targetSets: e.targetSets ?? 3,
      targetReps: e.targetReps ?? 10,
      targetWeight: e.targetWeight ?? null,
      restSeconds: e.restSeconds ?? 90,
    })),
  }))

  const now = new Date()
  const plans = await getWorkoutPlansCollection()
  const result = await plans.insertOne({
    userId: new ObjectId(locals.userId),
    name: body.name.trim(),
    sessions,
    createdAt: now,
    updatedAt: now,
  })

  const created = await plans.findOne({ _id: result.insertedId })
  return json(serializeWorkoutPlan(created!), { status: 201 })
}
