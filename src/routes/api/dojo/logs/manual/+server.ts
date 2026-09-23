import {
  CARDIO_TYPES,
  createManualCardioLog,
  serializeWorkoutLog,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

function optionalNonNegative(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  if (!CARDIO_TYPES.includes(body.cardioType)) {
    return json({ error: "Invalid cardioType" }, { status: 400 })
  }

  const startedAt = new Date(body.startedAt)
  const completedAt = new Date(body.completedAt)
  if (!body.startedAt || isNaN(startedAt.getTime())) {
    return json({ error: "startedAt is required" }, { status: 400 })
  }
  if (!body.completedAt || isNaN(completedAt.getTime())) {
    return json({ error: "completedAt is required" }, { status: 400 })
  }
  if (completedAt <= startedAt) {
    return json({ error: "Completed must be after started" }, { status: 400 })
  }

  const cardioDistance = Number(body.cardioDistance)
  if (!Number.isFinite(cardioDistance) || cardioDistance <= 0) {
    return json({ error: "Distance must be greater than 0" }, { status: 400 })
  }
  const caloriesBurned = optionalNonNegative(body.caloriesBurned)
  if (caloriesBurned === undefined) {
    return json({ error: "Calories must be a non-negative number" }, { status: 400 })
  }

  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null

  const created = await createManualCardioLog(new ObjectId(locals.userId), {
    cardioType: body.cardioType,
    startedAt,
    completedAt,
    cardioDistance,
    caloriesBurned,
    notes,
  })

  return json(serializeWorkoutLog(created), { status: 201 })
}
