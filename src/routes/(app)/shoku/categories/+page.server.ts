import { getFoodItemCategoriesCollection, serializeFoodItemCategory } from "$lib/server/shoku"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { categories: [] }

  const categories = await getFoodItemCategoriesCollection()
  const list = await categories
    .find({ userId: new ObjectId(locals.userId) })
    .sort({ sortOrder: 1, name: 1 })
    .toArray()

  return { categories: list.map(serializeFoodItemCategory) }
}
