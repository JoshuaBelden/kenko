import {
  getExercisesCollection,
  getWorkoutLogsCollection,
  getWorkoutPlansCollection,
  exerciseFilterForUser,
  serializeExercise,
  serializeWorkoutLog,
  serializeWorkoutPlan,
} from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { plans: [], logs: [], exercises: [] }

  const userId = new ObjectId(locals.userId)

  const [plansCol, logsCol, exercisesCol] = await Promise.all([
    getWorkoutPlansCollection(),
    getWorkoutLogsCollection(),
    getExercisesCollection(),
  ])

  const [plans, logs, exercises] = await Promise.all([
    plansCol.find({ userId }).sort({ createdAt: -1 }).toArray(),
    logsCol.find({ userId }).sort({ startedAt: -1 }).limit(20).toArray(),
    exercisesCol.find(exerciseFilterForUser(userId)).sort({ name: 1 }).toArray(),
  ])

  return {
    plans: plans.map(serializeWorkoutPlan),
    logs: logs.map(serializeWorkoutLog),
    exercises: exercises.map(serializeExercise),
  }
}
