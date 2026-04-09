import {
  getExercisesCollection,
  getWorkoutPlansCollection,
  getWorkoutLogsCollection,
  exerciseFilterForUser,
  serializeExercise,
  ALL_MUSCLES,
  VALID_EQUIPMENT,
  VALID_REGIONS,
  MUSCLES_BY_REGION,
  type MuscleRegion,
  type Muscle,
  type Equipment,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const filter: Record<string, unknown> = exerciseFilterForUser(new ObjectId(locals.userId))

  const region = url.searchParams.get("region")
  if (region && VALID_REGIONS.includes(region as MuscleRegion)) {
    filter["muscleGroup.region"] = region
  }

  const muscle = url.searchParams.get("muscle")
  if (muscle && ALL_MUSCLES.includes(muscle as Muscle)) {
    filter["muscleGroup.muscle"] = muscle
  }

  const equipment = url.searchParams.get("equipment")
  if (equipment && VALID_EQUIPMENT.includes(equipment as Equipment)) {
    filter.equipment = equipment
  }

  const exercises = await getExercisesCollection()
  const list = await exercises.find(filter).sort({ name: 1 }).toArray()

  return json(list.map(serializeExercise))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name?.trim()) return json({ error: "name is required" }, { status: 400 })

  if (!body.muscleGroup?.region || !VALID_REGIONS.includes(body.muscleGroup.region)) {
    return json({ error: "valid muscleGroup.region is required" }, { status: 400 })
  }
  if (!body.muscleGroup?.muscle || !MUSCLES_BY_REGION[body.muscleGroup.region as MuscleRegion]?.includes(body.muscleGroup.muscle)) {
    return json({ error: "valid muscleGroup.muscle is required for the given region" }, { status: 400 })
  }
  if (!body.equipment || !VALID_EQUIPMENT.includes(body.equipment)) {
    return json({ error: "valid equipment is required" }, { status: 400 })
  }

  const now = new Date()
  const makeGlobal = locals.isAdmin && body.isGlobal === true
  const exercises = await getExercisesCollection()
  const result = await exercises.insertOne({
    userId: makeGlobal ? null : new ObjectId(locals.userId),
    isGlobal: makeGlobal,
    name: body.name.trim(),
    muscleGroup: {
      region: body.muscleGroup.region,
      muscle: body.muscleGroup.muscle,
    },
    equipment: body.equipment,
    createdAt: now,
    updatedAt: now,
  })

  const created = await exercises.findOne({ _id: result.insertedId })
  return json(serializeExercise(created!), { status: 201 })
}
