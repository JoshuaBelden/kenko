import { getJourneysCollection } from "$lib/server/collections"
import {
  JourneyValidationError,
  getActiveJourney,
  getWorkoutTypesForUser,
  parseWorkoutType,
} from "$lib/server/journeys"
import { WORKOUT_TYPES_MAX_COUNT } from "$lib/workoutTypes"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })
  return json(await getWorkoutTypesForUser(new ObjectId(locals.userId)))
}

/** Adds a workout type to the active journey. Returns the type (existing one if the name matches). */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  let type
  try {
    type = parseWorkoutType({ label: body.label })
  } catch (err) {
    if (err instanceof JourneyValidationError) return json({ error: err.message }, { status: 400 })
    throw err
  }

  const userId = new ObjectId(locals.userId)
  const journey = await getActiveJourney(userId)
  if (!journey) {
    return json({ error: "Start an active journey to save custom workout types" }, { status: 400 })
  }

  const current = await getWorkoutTypesForUser(userId)
  const existing = current.find((t) => t.key === type.key)
  if (existing) return json({ type: existing, workoutTypes: current })

  if (current.length >= WORKOUT_TYPES_MAX_COUNT) {
    return json({ error: `No more than ${WORKOUT_TYPES_MAX_COUNT} workout types` }, { status: 400 })
  }

  // Keep "Other" last so new types land with the real activities
  const otherIdx = current.findIndex((t) => t.key === "other")
  const workoutTypes =
    otherIdx === -1
      ? [...current, type]
      : [...current.slice(0, otherIdx), type, ...current.slice(otherIdx)]

  const journeys = await getJourneysCollection()
  await journeys.updateOne(
    { _id: journey._id, userId },
    { $set: { workoutTypes, updatedAt: new Date() } },
  )

  return json({ type, workoutTypes }, { status: 201 })
}
