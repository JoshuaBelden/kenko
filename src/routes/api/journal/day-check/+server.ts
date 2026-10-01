import { getJourneysCollection } from "$lib/server/collections"
import { getDayCheck } from "$lib/server/journal"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = url.searchParams.get("journeyId")
  const date = url.searchParams.get("date")

  if (!journeyId) return json({ error: "journeyId is required" }, { status: 400 })
  if (!date) return json({ error: "date is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: new ObjectId(journeyId), userId })
  if (!journey) return json({ error: "Journey not found" }, { status: 404 })

  const check = await getDayCheck(userId, journey, date, locals.userTimezone ?? "America/Los_Angeles")
  return json(check)
}
