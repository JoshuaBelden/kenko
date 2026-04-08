import { getFoodItemCategoriesCollection, serializeFoodItemCategory } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const categories = await getFoodItemCategoriesCollection()
  const list = await categories
    .find({ userId: new ObjectId(locals.userId) })
    .sort({ sortOrder: 1, name: 1 })
    .toArray()

  return json(list.map(serializeFoodItemCategory))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name?.trim()) return json({ error: "name is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const categories = await getFoodItemCategoriesCollection()

  // Auto-assign sortOrder to end
  const last = await categories.findOne({ userId }, { sort: { sortOrder: -1 } })
  const sortOrder = (last?.sortOrder ?? -1) + 1

  const now = new Date()
  const result = await categories.insertOne({
    userId,
    name: body.name.trim(),
    sortOrder,
    createdAt: now,
    updatedAt: now,
  })

  const created = await categories.findOne({ _id: result.insertedId })
  return json(serializeFoodItemCategory(created!), { status: 201 })
}
