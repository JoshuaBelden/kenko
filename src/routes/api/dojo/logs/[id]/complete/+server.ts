import { getWorkoutLogsCollection, serializeWorkoutLog } from "$lib/server/dojo"
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

  if (body.notes !== undefined) updates.notes = body.notes
  if (body.caloriesBurned !== undefined) updates.caloriesBurned = body.caloriesBurned
  if (body.cardioDistance !== undefined) updates.cardioDistance = body.cardioDistance

  const logs = await getWorkoutLogsCollection()

  // Fetch the current log to filter incomplete sets
  const existing = await logs.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
    status: "in_progress",
  })
  if (!existing) return json({ error: "Log not found or already completed" }, { status: 404 })

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
  return json(serializeWorkoutLog(result))
}
