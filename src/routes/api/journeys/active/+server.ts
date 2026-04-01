import { getJourneysCollection } from "$lib/server/collections"
import { serializeJourney } from "$lib/server/journeys"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const journeys = await getJourneysCollection()
  const list = await journeys
    .find({
      userId: new ObjectId(locals.userId),
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
    .sort({ startDate: -1 })
    .toArray()

  return json(list.map(serializeJourney))
}
