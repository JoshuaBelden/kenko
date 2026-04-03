import { getWeightLogEntries, serializeWeightLogEntry } from "$lib/server/journal"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const entries = await getWeightLogEntries(new ObjectId(locals.userId))
  return json(entries.map(serializeWeightLogEntry))
}
