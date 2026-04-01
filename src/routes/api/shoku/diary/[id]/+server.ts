import {
  calculateNutrients,
  getDiaryEntriesCollection,
  getFoodItemsCollection,
  serializeDiaryEntry,
  type DiaryUnit,
} from "$lib/server/shoku"
import { getActiveJourneyIds } from "$lib/server/journeys"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const VALID_CATEGORIES = ["uncategorized", "breakfast", "lunch", "dinner", "snack"]
const VALID_UNITS: DiaryUnit[] = ["g", "oz", "lb", "ml", "fl_oz", "tsp", "tbsp", "cup", "points", "serving"]

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const userId = new ObjectId(locals.userId)
  const entryId = new ObjectId(params.id)

  const diaryEntries = await getDiaryEntriesCollection()
  const existing = await diaryEntries.findOne({ _id: entryId, userId })
  if (!existing) return json({ error: "Not found" }, { status: 404 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  // Re-tag with active journeys based on the entry's diary date
  updates.journeyIds = await getActiveJourneyIds(userId, existing.date)

  if (body.category !== undefined && VALID_CATEGORIES.includes(body.category)) {
    updates.category = body.category
  }
  if (body.note !== undefined) updates.note = body.note

  const newQuantity = body.quantity !== undefined ? body.quantity : existing.quantity
  const newUnit: DiaryUnit = body.unit !== undefined && VALID_UNITS.includes(body.unit) ? body.unit : existing.unit

  if (body.quantity !== undefined || body.unit !== undefined) {
    updates.quantity = newQuantity
    updates.unit = newUnit

    const foodItems = await getFoodItemsCollection()
    const foodItem = await foodItems.findOne({ _id: existing.foodItemId })
    if (foodItem) {
      const nutrients = calculateNutrients(foodItem, newQuantity, newUnit)
      updates.calculatedCalories = nutrients.calories
      updates.calculatedProtein = nutrients.protein
      updates.calculatedNetCarbs = nutrients.netCarbs
      updates.calculatedFat = nutrients.fat
    }
  }

  const result = await diaryEntries.findOneAndUpdate(
    { _id: entryId, userId },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeDiaryEntry(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const diaryEntries = await getDiaryEntriesCollection()
  const result = await diaryEntries.findOneAndDelete({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
