import {
  getWorkoutPlansCollection,
  serializeWorkoutPlan,
  loadExerciseNameIndex,
  resolveOrCreateExercise,
  buildPlanSessionDoc,
} from "$lib/server/dojo"
import { normalizeDraftForUser } from "$lib/server/planGenerator"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

/** Saves a reviewed draft as a new plan, creating any new exercises in the user's library. */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const body = await request.json().catch(() => ({}))

  // Re-validate against the library: ids must be visible to this user, everything else is created by name
  const draft = await normalizeDraftForUser(userId, body.draft)
  if (draft.sessions.length === 0) return json({ error: "The plan needs at least one session with exercises." }, { status: 400 })

  const exerciseByName = await loadExerciseNameIndex(userId)
  const sessions = []
  for (const session of draft.sessions) {
    const exercises = []
    for (const ex of session.exercises) {
      const exerciseId = ex.exerciseId
        ? new ObjectId(ex.exerciseId)
        : (
            await resolveOrCreateExercise(userId, exerciseByName, {
              name: ex.name,
              muscleGroup: { region: ex.region, muscle: ex.muscle },
              equipment: ex.equipment,
            })
          )._id
      exercises.push({
        exerciseId,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        restSeconds: ex.restSeconds,
      })
    }
    sessions.push(buildPlanSessionDoc({ name: session.name, type: "strength", targetDayOfWeek: session.targetDayOfWeek }, exercises))
  }

  const now = new Date()
  const plans = await getWorkoutPlansCollection()
  const result = await plans.insertOne({
    userId,
    name: draft.name,
    sessions,
    createdAt: now,
    updatedAt: now,
  })

  const created = await plans.findOne({ _id: result.insertedId })
  return json(serializeWorkoutPlan(created!), { status: 201 })
}
