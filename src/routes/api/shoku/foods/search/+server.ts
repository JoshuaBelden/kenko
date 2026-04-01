import { getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const q = url.searchParams.get("q")?.trim()
  if (!q) return json([])

  const foodItems = await getFoodItemsCollection()
  const filter: Record<string, unknown> = {
    userId: new ObjectId(locals.userId),
    name: { $regex: q, $options: "i" },
  }

  const list = await foodItems.find(filter).sort({ name: 1 }).limit(20).toArray()

  return json(list.map(serializeFoodItem))
}
