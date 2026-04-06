import { getFoodItemLogsCollection, getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const foodItems = await getFoodItemsCollection()
  const item = await foodItems.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!item) return json({ error: "Not found" }, { status: 404 })
  return json(serializeFoodItem(item))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates.name = body.name
  if (body.brand !== undefined) updates.brand = body.brand
  if (body.barcode !== undefined) updates.barcode = body.barcode
  if (body.baseUnit !== undefined) updates.baseUnit = body.baseUnit
  if (body.servingSize !== undefined) updates.servingSize = body.servingSize
  if (body.servingUnit !== undefined) updates.servingUnit = body.servingUnit
  if (body.calories !== undefined) updates.calories = body.calories
  if (body.protein !== undefined) updates.protein = body.protein
  if (body.netCarbs !== undefined) updates.netCarbs = body.netCarbs
  if (body.fat !== undefined) updates.fat = body.fat
  if (body.fiber !== undefined) updates.fiber = body.fiber
  if (body.iron !== undefined) updates.iron = body.iron
  if (body.calcium !== undefined) updates.calcium = body.calcium
  if (body.vitaminA !== undefined) updates.vitaminA = body.vitaminA
  if (body.vitaminC !== undefined) updates.vitaminC = body.vitaminC
  if (body.vitaminB12 !== undefined) updates.vitaminB12 = body.vitaminB12
  if (body.folate !== undefined) updates.folate = body.folate
  if (body.potassium !== undefined) updates.potassium = body.potassium

  const foodItems = await getFoodItemsCollection()
  const result = await foodItems.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeFoodItem(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const foodItemId = new ObjectId(params.id)
  const userId = new ObjectId(locals.userId)

  const foodItems = await getFoodItemsCollection()
  const item = await foodItems.findOne({ _id: foodItemId, userId })
  if (!item) return json({ error: "Not found" }, { status: 404 })

  const foodItemLogs = await getFoodItemLogsCollection()
  const refCount = await foodItemLogs.countDocuments({ foodItemId, userId })

  if (refCount > 0) {
    return json(
      {
        error: `This food item is referenced by ${refCount} food ${refCount === 1 ? "log" : "logs"}. Delete those first, or proceed with force=true.`,
        refCount,
      },
      { status: 409 },
    )
  }

  await foodItems.deleteOne({ _id: foodItemId })
  return new Response(null, { status: 204 })
}
