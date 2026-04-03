import { updateMorning, upsertWeightLog, updateProfileWeight, serializeJournalEntry } from "$lib/server/journal"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const VALID_MORNING_FIELDS = ["bodyWeight", "sleepDuration", "sleepQuality", "notes"]

export const PUT: RequestHandler = async ({ locals, request, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const userId = new ObjectId(locals.userId)
  const entryId = new ObjectId(params.id)

  // Filter to valid fields only
  const fields: Record<string, any> = {}
  for (const key of VALID_MORNING_FIELDS) {
    if (key in body) {
      fields[key] = body[key]
    }
  }

  if (Object.keys(fields).length === 0) {
    return json({ error: "No valid fields provided" }, { status: 400 })
  }

  // Validate sleepQuality if present
  if (fields.sleepQuality !== undefined && fields.sleepQuality !== null) {
    const sq = Number(fields.sleepQuality)
    if (!Number.isInteger(sq) || sq < 1 || sq > 5) {
      return json({ error: "sleepQuality must be 1-5" }, { status: 400 })
    }
    fields.sleepQuality = sq
  }

  const updated = await updateMorning(entryId, userId, fields)
  if (!updated) {
    return json({ error: "Entry not found" }, { status: 404 })
  }

  // If bodyWeight was set, upsert weight log and update profile
  if (fields.bodyWeight != null) {
    const weight = Number(fields.bodyWeight)
    if (weight > 0) {
      const date = updated.date as string
      await Promise.all([
        upsertWeightLog(userId, date, weight),
        updateProfileWeight(userId, weight),
      ])
    }
  }

  return json(serializeJournalEntry(updated))
}
