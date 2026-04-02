import { getExercisesCollection, getWorkoutLogsCollection, exerciseFilterForUser, serializeExercise, serializeWorkoutLog } from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.userId) return { log: null, exercises: [] }

  const userId = new ObjectId(locals.userId)

  const [logsCol, exercisesCol] = await Promise.all([
    getWorkoutLogsCollection(),
    getExercisesCollection(),
  ])

  const log = await logsCol.findOne({ _id: new ObjectId(params.logId), userId })
  if (!log) return { log: null, exercises: [] }

  const allExercises = await exercisesCol.find(exerciseFilterForUser(userId)).sort({ name: 1 }).toArray()

  return {
    log: serializeWorkoutLog(log),
    exercises: allExercises.map(serializeExercise),
  }
}
