import { getJournalEntry, createJournalEntry, serializeJournalEntry } from "$lib/server/journal"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = url.searchParams.get("journeyId")
  const date = url.searchParams.get("date")

  if (!journeyId) return json({ error: "journeyId is required" }, { status: 400 })
  if (!date) return json({ error: "date is required" }, { status: 400 })

  const entry = await getJournalEntry(
    new ObjectId(locals.userId),
    new ObjectId(journeyId),
    date,
  )

  return json(entry ? serializeJournalEntry(entry) : null)
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { journeyId, date } = body

  if (!journeyId) return json({ error: "journeyId is required" }, { status: 400 })
  if (!date) return json({ error: "date is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const jId = new ObjectId(journeyId)

  // Check if entry already exists for this journey + date
  const existing = await getJournalEntry(userId, jId, date)
  if (existing) {
    return json(serializeJournalEntry(existing))
  }

  const entry = await createJournalEntry(userId, jId, date)
  return json(serializeJournalEntry(entry), { status: 201 })
}
