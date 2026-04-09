import { getFoodItemLogsCollection, getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const foodItemLogs = await getFoodItemLogsCollection()
  const foodItems = await getFoodItemsCollection()

  // Recent: last 10 unique food items by loggedAt
  const recentPipeline = [
    { $match: { userId } },
    { $sort: { loggedAt: -1 as const } },
    { $group: { _id: "$foodItemId", loggedAt: { $first: "$loggedAt" } } },
    { $sort: { loggedAt: -1 as const } },
    { $limit: 10 },
  ]

  // Frequent: top 10 food items by log count
  const frequentPipeline = [
    { $match: { userId } },
    { $group: { _id: "$foodItemId", count: { $sum: 1 } } },
    { $sort: { count: -1 as const } },
    { $limit: 10 },
  ]

  const [recentAgg, frequentAgg] = await Promise.all([
    foodItemLogs.aggregate(recentPipeline).toArray(),
    foodItemLogs.aggregate(frequentPipeline).toArray(),
  ])

  // Collect all unique foodItemIds
  const allIds = new Set<string>()
  for (const r of recentAgg) allIds.add(r._id.toString())
  for (const f of frequentAgg) allIds.add(f._id.toString())

  // Batch-fetch all food items
  const foodDocs = await foodItems
    .find({ _id: { $in: [...allIds].map((id) => new ObjectId(id)) } })
    .toArray()

  const foodMap = new Map(foodDocs.map((doc) => [doc._id.toString(), doc]))

  const recent = recentAgg
    .filter((r) => foodMap.has(r._id.toString()))
    .map((r) => ({ ...serializeFoodItem(foodMap.get(r._id.toString())!), source: "library" }))

  const frequent = frequentAgg
    .filter((f) => foodMap.has(f._id.toString()))
    .map((f) => ({ ...serializeFoodItem(foodMap.get(f._id.toString())!), source: "library" }))

  return json({ recent, frequent })
}
