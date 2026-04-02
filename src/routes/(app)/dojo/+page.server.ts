import {
  getExercisesCollection,
  getWorkoutLogsCollection,
  getWorkoutPlansCollection,
  serializeExercise,
  serializeWorkoutLog,
  serializeWorkoutPlan,
  startWorkoutLog,
} from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) return { plans: [], logs: [], exercises: [], newLog: null }

  const userId = new ObjectId(locals.userId)

  const journeyId = url.searchParams.get("journeyId")

  const [plansCol, logsCol, exercisesCol] = await Promise.all([
    getWorkoutPlansCollection(),
    getWorkoutLogsCollection(),
    getExercisesCollection(),
  ])

  const logFilter: Record<string, unknown> = { userId }
  if (journeyId) logFilter.journeyIds = new ObjectId(journeyId)

  const [plans, logs, exercises] = await Promise.all([
    plansCol.find({ userId }).sort({ createdAt: -1 }).toArray(),
    logsCol.find(logFilter).sort({ startedAt: -1 }).limit(20).toArray(),
    exercisesCol.find({ userId }).sort({ name: 1 }).toArray(),
  ])

  // Handle starting a new session from a plan (via query params)
  const startPlanId = url.searchParams.get("startPlan")
  const startSessionId = url.searchParams.get("startSession")
  let newLog = null

  if (startPlanId && startSessionId) {
    const created = await startWorkoutLog(userId, new ObjectId(startPlanId), startSessionId)
    if (created) {
      newLog = serializeWorkoutLog(created)
    }
  }

  return {
    plans: plans.map(serializeWorkoutPlan),
    logs: logs.map(serializeWorkoutLog),
    exercises: exercises.map(serializeExercise),
    newLog,
  }
}
