import {
  getExercisesCollection,
  getWorkoutPlansCollection,
  getWorkoutLogsCollection,
  exerciseFilterForUser,
  serializeExercise,
  VALID_REGIONS,
  MUSCLES_BY_REGION,
  VALID_EQUIPMENT,
  type MuscleRegion,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const exercises = await getExercisesCollection()
  const item = await exercises.findOne({
    _id: new ObjectId(params.id),
    ...exerciseFilterForUser(new ObjectId(locals.userId)),
  })

  if (!item) return json({ error: "Not found" }, { status: 404 })
  return json(serializeExercise(item))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const exercises = await getExercisesCollection()
  const existing = await exercises.findOne({ _id: new ObjectId(params.id) })
  if (!existing) return json({ error: "Not found" }, { status: 404 })
  if (existing.isGlobal && !locals.isAdmin) return json({ error: "Global exercises cannot be modified" }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.muscleGroup !== undefined) {
    if (!VALID_REGIONS.includes(body.muscleGroup.region)) {
      return json({ error: "valid muscleGroup.region is required" }, { status: 400 })
    }
    if (!MUSCLES_BY_REGION[body.muscleGroup.region as MuscleRegion]?.includes(body.muscleGroup.muscle)) {
      return json({ error: "valid muscleGroup.muscle is required" }, { status: 400 })
    }
    updates.muscleGroup = { region: body.muscleGroup.region, muscle: body.muscleGroup.muscle }
  }
  if (body.equipment !== undefined) {
    if (!VALID_EQUIPMENT.includes(body.equipment)) {
      return json({ error: "valid equipment is required" }, { status: 400 })
    }
    updates.equipment = body.equipment
  }

  if (locals.isAdmin && body.isGlobal !== undefined) {
    updates.isGlobal = body.isGlobal === true
    updates.userId = body.isGlobal ? null : existing.userId ?? new ObjectId(locals.userId)
  }

  const filter = locals.isAdmin
    ? { _id: new ObjectId(params.id) }
    : { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) }

  const result = await exercises.findOneAndUpdate(
    filter,
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeExercise(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const exerciseId = new ObjectId(params.id)
  const userId = new ObjectId(locals.userId)

  const exercises = await getExercisesCollection()
  const item = await exercises.findOne({ _id: exerciseId })
  if (!item) return json({ error: "Not found" }, { status: 404 })
  if (item.isGlobal && !locals.isAdmin) return json({ error: "Global exercises cannot be deleted" }, { status: 403 })
  if (!item.isGlobal && item.userId?.toString() !== locals.userId) return json({ error: "Not found" }, { status: 404 })

  // Check if referenced in any plan (for global exercises, check all users' plans)
  const plans = await getWorkoutPlansCollection()
  const planFilter = item.isGlobal
    ? { "sessions.exercises.exerciseId": exerciseId }
    : { userId, "sessions.exercises.exerciseId": exerciseId }
  const planRef = await plans.countDocuments(planFilter)

  if (planRef > 0) {
    return json(
      {
        error: `This exercise is referenced by ${planRef} workout ${planRef === 1 ? "plan" : "plans"}. Remove it from plans first, or proceed with force=true.`,
        refCount: planRef,
      },
      { status: 409 },
    )
  }

  await exercises.deleteOne({ _id: exerciseId })
  return new Response(null, { status: 204 })
}
