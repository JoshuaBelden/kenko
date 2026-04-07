import { getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { barcodeVariants, lookupBarcodeWithRaw } from "$lib/server/nutritionApi"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const barcode = params.barcode
  const foodItems = await getFoodItemsCollection()

  const existing = await foodItems.findOne({
    barcode: { $in: barcodeVariants(barcode) },
    userId: new ObjectId(locals.userId),
  })

  if (existing) {
    return json({ match: true, foodItem: serializeFoodItem(existing) })
  }

  const result = await lookupBarcodeWithRaw(barcode)
  return json({
    match: false,
    nutritionData: result?.mapped ?? null,
    raw: result?.raw ?? null,
  })
}
