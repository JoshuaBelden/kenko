import {
  getExercisesCollection,
  getWorkoutPlansCollection,
  exerciseFilterForUser,
  serializeWorkoutPlan,
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
  const exercisesCol = await getExercisesCollection()

  // Load all exercises visible to this user for name matching
  const userExercises = await exercisesCol.find(exerciseFilterForUser(userId)).toArray()
  const exerciseByName = new Map(userExercises.map(e => [e.name.toLowerCase(), e]))

  // Resolve each exercise by name — create user-scoped exercises for any that don't exist
  const resolvedSessions = []
  for (const session of body.sessions) {
    const resolvedExercises = []
    for (const ex of session.exercises ?? []) {
      const name = ex.exerciseName?.trim()
      if (!name) continue

      let matched: { _id: ObjectId; [key: string]: any } | undefined = exerciseByName.get(name.toLowerCase())
      if (!matched) {
        // Create a user-scoped exercise
        const now = new Date()
        const result = await exercisesCol.insertOne({
          userId,
          isGlobal: false,
          name,
          muscleGroup: ex.muscleGroup ?? { region: "torso", muscle: "chest" },
          equipment: ex.equipment ?? "bodyweight",
          createdAt: now,
          updatedAt: now,
        })
        matched = (await exercisesCol.findOne({ _id: result.insertedId })) ?? undefined
        exerciseByName.set(name.toLowerCase(), matched!)
      }

      resolvedExercises.push({
        _id: new ObjectId(),
        exerciseId: matched!._id,
        order: ex.order ?? resolvedExercises.length,
        targetSets: ex.targetSets ?? 3,
        targetReps: ex.targetReps ?? 10,
        targetWeight: ex.targetWeight ?? null,
        restSeconds: ex.restSeconds ?? 90,
      })
    }

    resolvedSessions.push({
      _id: new ObjectId(),
      name: session.name ?? "Session",
      type: session.type === "cardio" ? "cardio" : "strength",
      targetDayOfWeek: session.targetDayOfWeek ?? null,
      exercises: resolvedExercises,
    })
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
