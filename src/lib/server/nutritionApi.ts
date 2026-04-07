/**
 * Returns an array of barcode variants to match against.
 * Handles UPC-A (12 digits) ↔ EAN-13 (13 digits) conversion.
 */
export function barcodeVariants(barcode: string): string[] {
  const variants = [barcode]
  if (barcode.length === 12) {
    variants.push("0" + barcode) // UPC-A → EAN-13
  } else if (barcode.length === 13 && barcode.startsWith("0")) {
    variants.push(barcode.slice(1)) // EAN-13 → UPC-A
  }
  return variants
}

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
  saturatedFat: number | null
  transFat: number | null
  fiber: number | null
  addedSugars: number | null
  cholesterol: number | null
  sodium: number | null
  iron: number | null
  calcium: number | null
  magnesium: number | null
  vitaminA: number | null
  vitaminC: number | null
  vitaminB12: number | null
  vitaminE: number | null
  vitaminK: number | null
  folate: number | null
  potassium: number | null
  zinc: number | null
}

export interface BarcodeLookupResult {
  mapped: NutritionApiResult
  raw: Record<string, unknown>
}

function mapProduct(product: Record<string, unknown>, barcode: string): NutritionApiResult {
  const n = (product.nutriments as Record<string, unknown>) ?? {}

  const servingUnit = ((product.serving_quantity_unit as string) ?? "g").toLowerCase()
  const baseUnit: "g" | "ml" = servingUnit === "ml" || servingUnit === "l" ? "ml" : "g"

  const servingQty = typeof product.serving_quantity === "number" ? product.serving_quantity : null

  const num = (key: string): number | null => {
    const v = n[key]
    return typeof v === "number" ? Math.round(v * 10) / 10 : null
  }

  const carbsServing = num("carbohydrates_serving")
  const fiberServing = num("fiber_serving")
  let netCarbs: number | null = null
  if (carbsServing !== null) {
    netCarbs = fiberServing !== null ? Math.round((carbsServing - fiberServing) * 10) / 10 : carbsServing
  }

  return {
    name: product.product_name as string,
    brand: (product.brands as string) ?? null,
    barcode: (product.code as string) ?? barcode,
    baseUnit,
    servingSize: servingQty,
    servingUnit: (product.serving_size as string) ?? null,
    calories: num("energy-kcal_serving"),
    protein: num("proteins_serving"),
    netCarbs,
    fat: num("fat_serving"),
    saturatedFat: num("saturated-fat_serving"),
    transFat: num("trans-fat_serving"),
    fiber: fiberServing,
    addedSugars: num("added-sugars_serving"),
    cholesterol: num("cholesterol_serving"),
    sodium: num("sodium_serving"),
    iron: num("iron_serving"),
    calcium: num("calcium_serving"),
    magnesium: num("magnesium_serving"),
    vitaminA: num("vitamin-a_serving"),
    vitaminC: num("vitamin-c_serving"),
    vitaminB12: num("vitamin-b12_serving"),
    vitaminE: num("vitamin-e_serving"),
    vitaminK: num("vitamin-k_serving"),
    folate: num("folates_serving"),
    potassium: num("potassium_serving"),
    zinc: num("zinc_serving"),
  }
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

    return {
      mapped: mapProduct(data.product, barcode),
      raw: data.product as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

export async function searchByName(query: string): Promise<NutritionApiResult[]> {
  try {
    const url = `https://world.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=en&cc=us`
    const res = await fetch(url, {
      headers: { "User-Agent": "Kenko/1.0" },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const data = await res.json()
    if (!Array.isArray(data.products)) return []

    return data.products
      .filter((p: Record<string, unknown>) => p.product_name)
      .map((p: Record<string, unknown>) => mapProduct(p, (p.code as string) ?? ""))
  } catch {
    return []
  }
}
