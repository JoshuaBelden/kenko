import { getExercisesCollection, getWorkoutPlansCollection, serializeExercise, serializeWorkoutPlan } from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { plans: [], exercises: [] }

  const userId = new ObjectId(locals.userId)

  const [plansCol, exercisesCol] = await Promise.all([
    getWorkoutPlansCollection(),
    getExercisesCollection(),
  ])

  const [plans, exercises] = await Promise.all([
    plansCol.find({ userId }).sort({ createdAt: -1 }).toArray(),
    exercisesCol.find({ userId }).sort({ name: 1 }).toArray(),
  ])

  return {
    plans: plans.map(serializeWorkoutPlan),
    exercises: exercises.map(serializeExercise),
  }
}
