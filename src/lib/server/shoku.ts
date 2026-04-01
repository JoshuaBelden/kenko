import type { Document, ObjectId, WithId } from "mongodb"
import { getDb } from "./db"
import { getActiveJourneyIds } from "./journeys"

// ========================================
// Collections
// ========================================

export async function getFoodItemsCollection() {
  const db = await getDb()
  return db.collection("foodItems")
}

export async function getDiaryEntriesCollection() {
  const db = await getDb()
  return db.collection("diaryEntries")
}

// ========================================
// Unit Conversion
// ========================================

type MassUnit = "g" | "oz" | "lb"
type VolumeUnit = "ml" | "fl_oz" | "tsp" | "tbsp" | "cup"
export type DiaryUnit = MassUnit | VolumeUnit | "points" | "serving"
export type BaseUnit = "g" | "ml"

const UNIT_CONVERSIONS: Record<Exclude<DiaryUnit, "points" | "serving">, { baseUnit: BaseUnit; ratio: number }> = {
  g: { baseUnit: "g", ratio: 1 },
  oz: { baseUnit: "g", ratio: 28.35 },
  lb: { baseUnit: "g", ratio: 453.59 },
  ml: { baseUnit: "ml", ratio: 1 },
  fl_oz: { baseUnit: "ml", ratio: 29.57 },
  tsp: { baseUnit: "ml", ratio: 4.93 },
  tbsp: { baseUnit: "ml", ratio: 14.79 },
  cup: { baseUnit: "ml", ratio: 236.59 },
}

export function isUnitCompatible(unit: DiaryUnit, foodBaseUnit: BaseUnit): boolean {
  if (unit === "points" || unit === "serving") return true
  return UNIT_CONVERSIONS[unit].baseUnit === foodBaseUnit
}

export function getCompatibleUnits(foodBaseUnit: BaseUnit): DiaryUnit[] {
  const units: DiaryUnit[] = []
  for (const [unit, conv] of Object.entries(UNIT_CONVERSIONS)) {
    if (conv.baseUnit === foodBaseUnit) units.push(unit as DiaryUnit)
  }
  units.push("points")
  return units
}

export function calculateNutrients(
  foodItem: Document,
  quantity: number,
  unit: DiaryUnit,
): { calories: number; protein: number; netCarbs: number; fat: number } {
  if (unit === "points") {
    return {
      calories: foodItem.calories ?? 0,
      protein: 0,
      netCarbs: 0,
      fat: 0,
    }
  }

  // "serving" means quantity is already in servings — multiply directly
  let servings: number
  if (unit === "serving") {
    servings = quantity
  } else {
    const servingSize = foodItem.servingSize ?? 100
    const conv = UNIT_CONVERSIONS[unit]
    const baseAmount = quantity * conv.ratio
    servings = baseAmount / servingSize
  }

  return {
    calories: Math.round((foodItem.calories ?? 0) * servings * 10) / 10,
    protein: Math.round((foodItem.protein ?? 0) * servings * 10) / 10,
    netCarbs: Math.round((foodItem.netCarbs ?? 0) * servings * 10) / 10,
    fat: Math.round((foodItem.fat ?? 0) * servings * 10) / 10,
  }
}

// ========================================
// Serializers
// ========================================

export function serializeFoodItem(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    brand: doc.brand ?? null,
    baseUnit: doc.baseUnit,
    servingSize: doc.servingSize ?? null,
    servingUnit: doc.servingUnit ?? null,
    calories: doc.calories ?? 0,
    protein: doc.protein ?? 0,
    netCarbs: doc.netCarbs ?? 0,
    fat: doc.fat ?? 0,
    fiber: doc.fiber ?? null,
    iron: doc.iron ?? null,
    calcium: doc.calcium ?? null,
    vitaminA: doc.vitaminA ?? null,
    vitaminC: doc.vitaminC ?? null,
    vitaminB12: doc.vitaminB12 ?? null,
    folate: doc.folate ?? null,
    potassium: doc.potassium ?? null,
    source: doc.source ?? "manual",
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export function serializeDiaryEntry(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    foodItemId: doc.foodItemId.toString(),
    foodName: doc.foodName ?? "",
    foodBrand: doc.foodBrand ?? null,
    journeyIds: (doc.journeyIds ?? []).map((id: ObjectId) => id.toString()),
    date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
    loggedAt: doc.loggedAt instanceof Date ? doc.loggedAt.toISOString() : doc.loggedAt,
    category: doc.category ?? "uncategorized",
    quantity: doc.quantity,
    unit: doc.unit,
    calculatedCalories: doc.calculatedCalories ?? 0,
    calculatedProtein: doc.calculatedProtein ?? 0,
    calculatedNetCarbs: doc.calculatedNetCarbs ?? 0,
    calculatedFat: doc.calculatedFat ?? 0,
    note: doc.note ?? null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

// ========================================
// Diary Helpers
// ========================================

export async function createDiaryEntry(
  userId: ObjectId,
  foodItemId: ObjectId,
  foodItem: Document,
  date: Date,
  category: string,
  quantity: number,
  unit: DiaryUnit,
  note: string | null,
) {
  const now = new Date()
  const nutrients = calculateNutrients(foodItem, quantity, unit)
  const journeyIds = await getActiveJourneyIds(userId, date)

  const diaryEntries = await getDiaryEntriesCollection()

  const entry = {
    userId,
    foodItemId,
    foodName: foodItem.name,
    foodBrand: foodItem.brand ?? null,
    journeyIds,
    date,
    loggedAt: now,
    category,
    quantity,
    unit,
    calculatedCalories: nutrients.calories,
    calculatedProtein: nutrients.protein,
    calculatedNetCarbs: nutrients.netCarbs,
    calculatedFat: nutrients.fat,
    note,
    createdAt: now,
    updatedAt: now,
  }

  const result = await diaryEntries.insertOne(entry)
  const created = await diaryEntries.findOne({ _id: result.insertedId })
  return created!
}
