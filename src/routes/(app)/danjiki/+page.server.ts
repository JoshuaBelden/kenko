import { getFastsCollection, serializeFast } from "$lib/server/danjiki"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { fasts: [], activeFast: null }

  const userId = new ObjectId(locals.userId)
  const fastsCol = await getFastsCollection()

  const activeFast = await fastsCol.findOne({ userId, status: "running" })
  const completedFasts = await fastsCol
    .find({ userId, status: "completed" })
    .sort({ startedAt: -1 })
    .toArray()

  return {
    activeFast: activeFast ? serializeFast(activeFast) : null,
    fasts: completedFasts.map(serializeFast),
  }
}
