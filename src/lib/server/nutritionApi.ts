export interface NutritionApiResult {
  name: string
  brand: string | null
  barcode: string
  baseUnit: "g" | "ml"
  servingSize: number | null
  servingUnit: string | null
  calories: number | null
  protein: number | null
  netCarbs: number | null
  fat: number | null
  fiber: number | null
  iron: number | null
  calcium: number | null
  vitaminA: number | null
  vitaminC: number | null
  vitaminB12: number | null
  folate: number | null
  potassium: number | null
}

export interface BarcodeLookupResult {
  mapped: NutritionApiResult
  raw: Record<string, unknown>
}

export async function lookupBarcode(barcode: string): Promise<NutritionApiResult | null> {
  const result = await lookupBarcodeWithRaw(barcode)
  return result?.mapped ?? null
}

export async function lookupBarcodeWithRaw(barcode: string): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}`, {
      headers: { "User-Agent": "Kenko/1.0" },
    })

    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 1 || !data.product?.product_name) return null

    const product = data.product
    const n = product.nutriments ?? {}

    const quantity = (product.quantity ?? "").toLowerCase()
    const baseUnit: "g" | "ml" = quantity.includes("ml") || quantity.includes("l") ? "ml" : "g"

    const servingQty = typeof product.serving_quantity === "number" ? product.serving_quantity : null

    const num = (key: string): number | null => {
      const v = n[key]
      return typeof v === "number" ? Math.round(v * 10) / 10 : null
    }

    const carbsTotal = num("carbohydrates_100g")
    const fiberVal = num("fiber_100g")
    let netCarbs: number | null = null
    if (carbsTotal !== null) {
      netCarbs = fiberVal !== null ? Math.round((carbsTotal - fiberVal) * 10) / 10 : carbsTotal
    }

    return {
      mapped: {
        name: product.product_name,
        brand: product.brands ?? null,
        barcode,
        baseUnit,
        servingSize: servingQty,
        servingUnit: product.serving_size ?? null,
        calories: num("energy-kcal_serving"),
        protein: num("proteins_100g"),
        netCarbs,
        fat: num("fat_100g"),
        fiber: fiberVal,
        iron: num("iron_100g"),
        calcium: num("calcium_100g"),
        vitaminA: num("vitamin-a_100g"),
        vitaminC: num("vitamin-c_100g"),
        vitaminB12: num("vitamin-b12_100g"),
        folate: num("folates_100g"),
        potassium: num("potassium_100g"),
      },
      raw: product as Record<string, unknown>,
    }
  } catch {
    return null
  }
}
