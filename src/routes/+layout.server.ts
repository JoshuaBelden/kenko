import { getUsersCollection } from "$lib/server/collections"
import { ObjectId } from "mongodb"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    return { user: null }
  }

  const users = await getUsersCollection()
  const user = await users.findOne({ _id: new ObjectId(locals.userId) })

  if (!user) {
    return { user: null }
  }

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      profileComplete: user.profileComplete ?? false,
      profile: user.profile ?? null,
    },
  }
}
