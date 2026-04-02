import { getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const plans = await getWorkoutPlansCollection()
  const plan = await plans.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!plan) return json({ error: "Not found" }, { status: 404 })
  return json(serializeWorkoutPlan(plan))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates.name = body.name.trim()

  const plans = await getWorkoutPlansCollection()
  const result = await plans.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeWorkoutPlan(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const plans = await getWorkoutPlansCollection()
  const result = await plans.deleteOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (result.deletedCount === 0) return json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
