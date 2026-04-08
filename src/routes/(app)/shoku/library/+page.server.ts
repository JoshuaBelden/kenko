import { getFoodItemsCollection, getFoodItemCategoriesCollection, serializeFoodItem, serializeFoodItemCategory } from "$lib/server/shoku"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { foods: [], categories: [] }

  const userId = new ObjectId(locals.userId)
  const [foodItems, categoriesCol] = await Promise.all([
    getFoodItemsCollection(),
    getFoodItemCategoriesCollection(),
  ])

  const [foods, categories] = await Promise.all([
    foodItems.find({ userId }).sort({ name: 1 }).toArray(),
    categoriesCol.find({ userId }).sort({ sortOrder: 1, name: 1 }).toArray(),
  ])

  return {
    foods: foods.map(serializeFoodItem),
    categories: categories.map(serializeFoodItemCategory),
  }
}
