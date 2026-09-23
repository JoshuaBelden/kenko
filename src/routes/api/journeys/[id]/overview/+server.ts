import { getJourneysCollection } from "$lib/server/collections"
import { getJourneyOverview } from "$lib/server/overview"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  const userTz = locals.userTimezone ?? "America/Los_Angeles"
  return json(await getJourneyOverview(userId, journey, userTz))
}
