import { createDiaryEntry, getFoodItemsCollection, serializeDiaryEntry } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name?.trim()) return json({ error: "name is required" }, { status: 400 })
  if (!body.calories || body.calories <= 0) return json({ error: "calories must be positive" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const now = new Date()

  const foodItems = await getFoodItemsCollection()
  const foodResult = await foodItems.insertOne({
    userId,
    name: body.name.trim(),
    brand: null,
    baseUnit: "g",
    servingSize: null,
    servingUnit: null,
    calories: body.calories,
    protein: 0,
    netCarbs: 0,
    fat: 0,
    fiber: null,
    iron: null,
    calcium: null,
    vitaminA: null,
    vitaminC: null,
    vitaminB12: null,
    folate: null,
    potassium: null,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  })

  const foodItem = await foodItems.findOne({ _id: foodResult.insertedId })
  const date = body.date
    ? new Date(body.date + "T00:00:00.000Z")
    : new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z")

  const created = await createDiaryEntry(
    userId,
    foodResult.insertedId,
    foodItem!,
    date,
    "uncategorized",
    1,
    "points",
    null,
  )

  return json(serializeDiaryEntry(created), { status: 201 })
}
