import { getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { foods: [] }

  const foodItems = await getFoodItemsCollection()
  const list = await foodItems
    .find({ userId: new ObjectId(locals.userId) })
    .sort({ name: 1 })
    .toArray()

  return { foods: list.map(serializeFoodItem) }
}
