import { updateEvening, serializeJournalEntry } from "$lib/server/journal"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const VALID_EVENING_FIELDS = ["mood", "energy", "highlights", "challenges", "intention", "dayRating", "notes"]
const RATING_FIELDS = ["mood", "energy", "dayRating"]

export const PUT: RequestHandler = async ({ locals, request, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const userId = new ObjectId(locals.userId)
  const entryId = new ObjectId(params.id)

  // Filter to valid fields only
  const fields: Record<string, any> = {}
  for (const key of VALID_EVENING_FIELDS) {
    if (key in body) {
      fields[key] = body[key]
    }
  }

  if (Object.keys(fields).length === 0) {
    return json({ error: "No valid fields provided" }, { status: 400 })
  }

  // Validate rating fields (1-5)
  for (const key of RATING_FIELDS) {
    if (fields[key] !== undefined && fields[key] !== null) {
      const val = Number(fields[key])
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return json({ error: `${key} must be 1-5` }, { status: 400 })
      }
      fields[key] = val
    }
  }

  const updated = await updateEvening(entryId, userId, fields)
  if (!updated) {
    return json({ error: "Entry not found" }, { status: 404 })
  }

  return json(serializeJournalEntry(updated))
}
