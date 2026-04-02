import {
  getExercisesCollection,
  getWorkoutPlansCollection,
  getWorkoutLogsCollection,
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
    userId: new ObjectId(locals.userId),
  })

  if (!item) return json({ error: "Not found" }, { status: 404 })
  return json(serializeExercise(item))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

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

  const exercises = await getExercisesCollection()
  const result = await exercises.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
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
  const item = await exercises.findOne({ _id: exerciseId, userId })
  if (!item) return json({ error: "Not found" }, { status: 404 })

  // Check if referenced in any plan
  const plans = await getWorkoutPlansCollection()
  const planRef = await plans.countDocuments({
    userId,
    "sessions.exercises.exerciseId": exerciseId,
  })

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
