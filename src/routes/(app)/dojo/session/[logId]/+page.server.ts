import { getExercisesCollection, getWorkoutLogsCollection, exerciseFilterForUser, serializeExercise, serializeWorkoutLog } from "$lib/server/dojo"
import { getWorkoutTypesForUser } from "$lib/server/journeys"
import { DEFAULT_WORKOUT_TYPES } from "$lib/workoutTypes"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.userId) return { log: null, exercises: [], workoutTypes: DEFAULT_WORKOUT_TYPES }

  const userId = new ObjectId(locals.userId)

  const [logsCol, exercisesCol] = await Promise.all([
    getWorkoutLogsCollection(),
    getExercisesCollection(),
  ])

  const log = await logsCol.findOne({ _id: new ObjectId(params.logId), userId })
  if (!log) return { log: null, exercises: [], workoutTypes: DEFAULT_WORKOUT_TYPES }

  const [allExercises, workoutTypes] = await Promise.all([
    exercisesCol.find(exerciseFilterForUser(userId)).sort({ name: 1 }).toArray(),
    getWorkoutTypesForUser(userId),
  ])

  return {
    log: serializeWorkoutLog(log),
    exercises: allExercises.map(serializeExercise),
    workoutTypes,
  }
}
