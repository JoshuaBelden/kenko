import {
  CARDIO_TYPES,
  calculateAndStorePerformance,
  calculateCardioPerformance,
  getWorkoutLogsCollection,
  serializeWorkoutLog,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const now = new Date()

  const updates: Record<string, unknown> = {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  }

  if (body.startedAt) updates.startedAt = new Date(body.startedAt)
  if (body.completedAt) updates.completedAt = new Date(body.completedAt)
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.caloriesBurned !== undefined) updates.caloriesBurned = body.caloriesBurned
  if (body.cardioDistance !== undefined) updates.cardioDistance = body.cardioDistance

  if (body.cardioType !== undefined) {
    if (body.cardioType !== null && !CARDIO_TYPES.includes(body.cardioType)) {
      return json({ error: "Invalid cardioType" }, { status: 400 })
    }
    updates.cardioType = body.cardioType
  }

  if (body.rpe !== undefined && body.rpe !== null) {
    const rpeNum = Number(body.rpe)
    if (!Number.isInteger(rpeNum) || rpeNum < 1 || rpeNum > 10) {
      return json({ error: "rpe must be an integer 1-10" }, { status: 400 })
    }
    updates.rpe = rpeNum
  }

  const logs = await getWorkoutLogsCollection()

  // Fetch the current log to filter incomplete sets
  const existing = await logs.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
    status: "in_progress",
  })
  if (!existing) return json({ error: "Log not found or already completed" }, { status: 404 })

  const isCardio = existing.planSnapshot?.sessionType === "cardio"
  if (isCardio && updates.rpe == null) {
    return json({ error: "rpe is required to complete a cardio session" }, { status: 400 })
  }

  // Remove sets that were not marked as completed
  const completedSets = (existing.sets ?? []).filter((s: any) => s.completed === true)

  // Find exerciseIds that still have sets
  const exerciseIdsWithSets = new Set(completedSets.map((s: any) => s.exerciseId.toString()))

  // Remove exercises from snapshot that have no remaining sets
  const prunedExercises = (existing.planSnapshot?.exercises ?? []).filter(
    (e: any) => exerciseIdsWithSets.has(e.exerciseId.toString()),
  )

  updates.sets = completedSets
  if (existing.planSnapshot) {
    updates["planSnapshot.exercises"] = prunedExercises
  }

  const result = await logs.findOneAndUpdate(
    {
      _id: new ObjectId(params.id),
      userId: new ObjectId(locals.userId),
      status: "in_progress",
    },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Log not found or already completed" }, { status: 404 })

  // Calculate and store performance data
  if (result.planSnapshot?.sessionType === "strength") {
    await calculateAndStorePerformance(result, new ObjectId(locals.userId))
  } else if (result.planSnapshot?.sessionType === "cardio") {
    await calculateCardioPerformance(result)
  }

  const updated = await logs.findOne({ _id: result._id })
  return json(serializeWorkoutLog(updated ?? result))
}
