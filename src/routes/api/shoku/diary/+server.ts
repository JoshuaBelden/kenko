import {
  createFoodItemLog,
  getFoodItemLogsCollection,
  getFoodItemsCollection,
  serializeFoodItemLog,
  type DiaryUnit,
} from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const VALID_CATEGORIES = ["uncategorized", "breakfast", "lunch", "dinner", "snack"]
const VALID_UNITS: DiaryUnit[] = ["g", "oz", "lb", "ml", "fl_oz", "tsp", "tbsp", "cup", "points", "serving"]

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const dateStr = url.searchParams.get("date")
  if (!dateStr) return json({ error: "date query parameter is required" }, { status: 400 })

  const date = new Date(dateStr + "T00:00:00.000Z")
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)

  const filter: Record<string, unknown> = {
    userId: new ObjectId(locals.userId),
    date: { $gte: date, $lt: nextDate },
  }

  const foodItemLogs = await getFoodItemLogsCollection()
  const entries = await foodItemLogs.find(filter).sort({ loggedAt: 1 }).toArray()

  const serialized = entries.map(serializeFoodItemLog)

  const grouped: Record<string, typeof serialized> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    uncategorized: [],
  }
  let totals = { calories: 0, protein: 0, netCarbs: 0, fat: 0 }

  for (const entry of serialized) {
    const cat = entry.category in grouped ? entry.category : "uncategorized"
    grouped[cat].push(entry)
    totals.calories += entry.calculatedCalories
    totals.protein += entry.calculatedProtein
    totals.netCarbs += entry.calculatedNetCarbs
    totals.fat += entry.calculatedFat
  }

  totals.protein = Math.round(totals.protein * 10) / 10
  totals.netCarbs = Math.round(totals.netCarbs * 10) / 10
  totals.fat = Math.round(totals.fat * 10) / 10

  return json({ grouped, totals })
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.foodItemId) return json({ error: "foodItemId is required" }, { status: 400 })
  if (!body.quantity || body.quantity <= 0) return json({ error: "quantity must be positive" }, { status: 400 })
  if (!body.unit || !VALID_UNITS.includes(body.unit)) return json({ error: "invalid unit" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const foodItemId = new ObjectId(body.foodItemId)

  const foodItems = await getFoodItemsCollection()
  const foodItem = await foodItems.findOne({ _id: foodItemId, userId })
  if (!foodItem) return json({ error: "Food item not found" }, { status: 404 })

  const date = body.date
    ? new Date(body.date + "T00:00:00.000Z")
    : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")
  const category = body.category && VALID_CATEGORIES.includes(body.category) ? body.category : "uncategorized"

  const created = await createFoodItemLog(
    userId,
    foodItemId,
    foodItem,
    date,
    category,
    body.quantity,
    body.unit,
    body.note ?? null,
  )

  return json(serializeFoodItemLog(created), { status: 201 })
}
