import { getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const foodItems = await getFoodItemsCollection()
  const list = await foodItems
    .find({ userId: new ObjectId(locals.userId) })
    .sort({ name: 1 })
    .toArray()

  return json(list.map(serializeFoodItem))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name) return json({ error: "name is required" }, { status: 400 })
  if (!body.baseUnit || !["g", "ml"].includes(body.baseUnit)) {
    return json({ error: "baseUnit must be 'g' or 'ml'" }, { status: 400 })
  }

  const now = new Date()
  const foodItems = await getFoodItemsCollection()
  const result = await foodItems.insertOne({
    userId: new ObjectId(locals.userId),
    name: body.name,
    brand: body.brand ?? null,
    barcode: body.barcode ?? null,
    baseUnit: body.baseUnit,
    servingSize: body.servingSize ?? null,
    servingUnit: body.servingUnit ?? null,
    calories: body.calories ?? 0,
    protein: body.protein ?? 0,
    netCarbs: body.netCarbs ?? 0,
    fat: body.fat ?? 0,
    saturatedFat: body.saturatedFat ?? null,
    transFat: body.transFat ?? null,
    fiber: body.fiber ?? null,
    addedSugars: body.addedSugars ?? null,
    cholesterol: body.cholesterol ?? null,
    sodium: body.sodium ?? null,
    iron: body.iron ?? null,
    calcium: body.calcium ?? null,
    magnesium: body.magnesium ?? null,
    vitaminA: body.vitaminA ?? null,
    vitaminC: body.vitaminC ?? null,
    vitaminB12: body.vitaminB12 ?? null,
    vitaminE: body.vitaminE ?? null,
    vitaminK: body.vitaminK ?? null,
    folate: body.folate ?? null,
    potassium: body.potassium ?? null,
    zinc: body.zinc ?? null,
    source: body.source ?? "manual",
    debug: body.debug ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const created = await foodItems.findOne({ _id: result.insertedId })
  return json(serializeFoodItem(created!), { status: 201 })
}
