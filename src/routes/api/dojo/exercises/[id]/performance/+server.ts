import {
  getExercisesCollection,
  getWorkoutLogsCollection,
  serializeExercise,
  exerciseFilterForUser,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const exercises = await getExercisesCollection()
  const exerciseId = new ObjectId(params.id)
  const userId = new ObjectId(locals.userId)

  const exercise = await exercises.findOne({
    _id: exerciseId,
    ...exerciseFilterForUser(userId),
  })
  if (!exercise) return json({ error: "Exercise not found" }, { status: 404 })

  // Find all completed logs that have sets for this exercise
  const logs = await getWorkoutLogsCollection()
  const completedLogs = await logs
    .find({
      userId,
      status: "completed",
      "sets.exerciseId": exerciseId,
    })
    .sort({ completedAt: -1 })
    .toArray()

  const history = completedLogs.map((log) => {
    const ep = (log.performance?.exercisePerformance ?? []).find(
      (p: any) => p.exerciseId?.toString() === params.id,
    )
    return {
      logId: log._id.toString(),
      date: log.completedAt instanceof Date ? log.completedAt.toISOString() : log.completedAt,
      sessionName: log.planSnapshot?.sessionName ?? "Workout",
      totalVolume: ep?.totalVolume ?? 0,
      totalReps: ep?.totalReps ?? 0,
      e1RM: ep?.e1RM ?? null,
      personalBests: ep?.personalBests ?? [],
    }
  })

  return json({
    exercise: serializeExercise(exercise),
    history,
  })
}
