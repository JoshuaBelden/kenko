import { getUsersCollection, getJourneysCollection } from "$lib/server/collections"
import { ObjectId } from "mongodb"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    return { user: null, activeJourneys: [] }
  }

  const users = await getUsersCollection()
  const user = await users.findOne({ _id: new ObjectId(locals.userId) })

  if (!user) {
    return { user: null, activeJourneys: [] }
  }

  const journeysCol = await getJourneysCollection()
  const now = new Date()
  const activeJourneys = await journeysCol
    .find({
      userId: new ObjectId(locals.userId),
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
    .sort({ startDate: -1 })
    .toArray()

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      profileComplete: user.profileComplete ?? false,
      isAdmin: user.isAdmin ?? false,
      profile: user.profile ?? null,
    },
    activeJourneys: activeJourneys.map((j) => ({
      id: j._id.toString(),
      name: j.name,
      startDate: j.startDate instanceof Date ? j.startDate.toISOString() : j.startDate,
      endDate: j.endDate instanceof Date ? j.endDate.toISOString() : j.endDate,
    })),
  }
}
