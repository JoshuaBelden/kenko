import {
  getWorkoutPlansCollection,
  serializeWorkoutPlan,
  loadExerciseNameIndex,
  resolveOrCreateExercise,
  buildPlanSessionDoc,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.name?.trim()) return json({ error: "Invalid plan: name is required" }, { status: 400 })
  if (!Array.isArray(body.sessions)) return json({ error: "Invalid plan: sessions array is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)

  // Load all exercises visible to this user for name matching
  const exerciseByName = await loadExerciseNameIndex(userId)

  // Resolve each exercise by name — create user-scoped exercises for any that don't exist
  const resolvedSessions = []
  for (const session of body.sessions) {
    const resolvedExercises = []
    for (const ex of session.exercises ?? []) {
      const name = ex.exerciseName?.trim()
      if (!name) continue

      const matched = await resolveOrCreateExercise(userId, exerciseByName, {
        name,
        muscleGroup: ex.muscleGroup ?? { region: "torso", muscle: "chest" },
        equipment: ex.equipment ?? "bodyweight",
      })

      resolvedExercises.push({
        exerciseId: matched._id,
        order: ex.order ?? resolvedExercises.length,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        restSeconds: ex.restSeconds,
      })
    }

    resolvedSessions.push(buildPlanSessionDoc(session, resolvedExercises))
  }

  const now = new Date()
  const plansCol = await getWorkoutPlansCollection()
  const result = await plansCol.insertOne({
    userId,
    name: body.name.trim(),
    sessions: resolvedSessions,
    createdAt: now,
    updatedAt: now,
  })

  const created = await plansCol.findOne({ _id: result.insertedId })
  return json(serializeWorkoutPlan(created!), { status: 201 })
}
