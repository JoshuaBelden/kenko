import { getExercisesCollection, serializeExercise } from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { exercises: [] }

  const exercises = await getExercisesCollection()
  const list = await exercises
    .find({ userId: new ObjectId(locals.userId) })
    .sort({ name: 1 })
    .toArray()

  return { exercises: list.map(serializeExercise) }
}
