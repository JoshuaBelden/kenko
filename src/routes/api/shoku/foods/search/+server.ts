import { getFoodItemsCollection, serializeFoodItem } from "$lib/server/shoku"
import { barcodeVariants, searchByName } from "$lib/server/nutritionApi"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const q = url.searchParams.get("q")?.trim()
  if (!q) return json([])

  const source = url.searchParams.get("source")
  const libraryOnly = source === "library"

  const foodItems = await getFoodItemsCollection()
  const filter: Record<string, unknown> = {
    userId: new ObjectId(locals.userId),
    $or: [
      { name: { $regex: q, $options: "i" } },
      { barcode: { $in: barcodeVariants(q) } },
    ],
  }

  const libraryPromise = foodItems.find(filter).sort({ name: 1 }).limit(20).toArray()
  const offPromise = !libraryOnly && q.length >= 3 ? searchByName(q) : Promise.resolve([])

  const [libraryResult, offResult] = await Promise.allSettled([libraryPromise, offPromise])

  const libraryItems = (libraryResult.status === "fulfilled" ? libraryResult.value : []).map((doc) => ({
    ...serializeFoodItem(doc),
    source: "library",
  }))

  const libraryBarcodes = new Set(libraryItems.map((item) => item.barcode).filter(Boolean))

  const offItems =
    offResult.status === "fulfilled"
      ? offResult.value
          .filter((item) => !item.barcode || !libraryBarcodes.has(item.barcode))
          .map((item) => ({
            id: `off:${item.barcode}`,
            name: item.name,
            brand: item.brand,
            barcode: item.barcode,
            baseUnit: item.baseUnit,
            servingSize: item.servingSize,
            servingUnit: item.servingUnit,
            calories: item.calories ?? 0,
            protein: item.protein ?? 0,
            netCarbs: item.netCarbs ?? 0,
            fat: item.fat ?? 0,
            source: "openfoodfacts",
            _offData: item,
          }))
      : []

  const merged = [...libraryItems, ...offItems].slice(0, 20)

  return json(merged)
}
