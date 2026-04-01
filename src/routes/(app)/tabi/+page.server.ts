import { getJourneysCollection } from "$lib/server/collections"
import { serializeJourney } from "$lib/server/journeys"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { journeys: [] }

  const journeys = await getJourneysCollection()
  const list = await journeys.find({ userId: new ObjectId(locals.userId) }).sort({ startDate: -1 }).toArray()

  return {
    journeys: list.map(serializeJourney),
  }
}
