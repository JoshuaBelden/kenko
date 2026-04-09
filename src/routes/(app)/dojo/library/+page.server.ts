import { getExercisesCollection, exerciseFilterForUser, serializeExercise } from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { exercises: [], isAdmin: false }

  const userId = new ObjectId(locals.userId)
  const isAdmin = locals.isAdmin ?? false

  const exercises = await getExercisesCollection()
  const filter = isAdmin ? exerciseFilterForUser(userId) : { userId }
  const list = await exercises
    .find(filter)
    .sort({ name: 1 })
    .toArray()

  return { exercises: list.map(serializeExercise), isAdmin }
}
