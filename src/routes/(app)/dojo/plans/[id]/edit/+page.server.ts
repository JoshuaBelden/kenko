import { getExercisesCollection, exerciseFilterForUser, serializeExercise, serializeWorkoutPlan, getPlanForUser } from "$lib/server/dojo"
import { error } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.userId) return error(401, "Unauthorized")

  const userId = new ObjectId(locals.userId)
  const plan = await getPlanForUser(userId, params.id)
  if (!plan) return error(404, "Plan not found")

  const exercisesCol = await getExercisesCollection()
  const exercises = await exercisesCol.find(exerciseFilterForUser(userId)).sort({ name: 1 }).toArray()

  return {
    plan: serializeWorkoutPlan(plan),
    exercises: exercises.map(serializeExercise),
  }
}
