import {
  calculateAndStorePerformance,
  calculateCardioPerformance,
  getWorkoutLogsCollection,
  serializeWorkoutLog,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const logs = await getWorkoutLogsCollection()

  const log = await logs.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
    status: "completed",
  })
  if (!log) return json({ error: "Completed log not found" }, { status: 404 })

  if (log.planSnapshot?.sessionType === "cardio") {
    if (typeof log.rpe !== "number") {
      return json(
        { error: "Cannot recalculate cardio without an RPE. Set RPE first." },
        { status: 400 },
      )
    }
    await calculateCardioPerformance(log)
  } else {
    await calculateAndStorePerformance(log, new ObjectId(locals.userId))
  }

  const updated = await logs.findOne({ _id: log._id })
  return json(serializeWorkoutLog(updated!))
}
