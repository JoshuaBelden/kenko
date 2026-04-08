import { getFoodItemCategoriesCollection, getFoodItemsCollection, serializeFoodItemCategory } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder

  const categories = await getFoodItemCategoriesCollection()
  const result = await categories.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeFoodItemCategory(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const categoryId = new ObjectId(params.id)
  const userId = new ObjectId(locals.userId)
  const categories = await getFoodItemCategoriesCollection()

  const category = await categories.findOne({ _id: categoryId, userId })
  if (!category) return json({ error: "Not found" }, { status: 404 })

  // Nullify categoryId on any food items referencing this category
  const foodItems = await getFoodItemsCollection()
  await foodItems.updateMany({ userId, categoryId }, { $set: { categoryId: null } })

  await categories.deleteOne({ _id: categoryId })
  return new Response(null, { status: 204 })
}
