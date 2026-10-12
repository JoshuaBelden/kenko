/**
 * Client-side unit helpers for food diary.
 */

export type BaseUnit = "g" | "ml"
export type DiaryUnit = "g" | "oz" | "lb" | "ml" | "fl_oz" | "tsp" | "tbsp" | "cup" | "points" | "serving"

const MASS_UNITS: DiaryUnit[] = ["serving", "g", "oz", "lb"]
const VOLUME_UNITS: DiaryUnit[] = ["serving", "ml", "fl_oz", "tsp", "tbsp", "cup"]

const UNIT_LABELS: Record<DiaryUnit, string> = {
  serving: "serving",
  g: "g",
  oz: "oz",
  lb: "lb",
  ml: "ml",
  fl_oz: "fl oz",
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cup",
  points: "points",
}

// Ratio of each unit to its base unit (g or ml). Mirrors the server conversions in $lib/server/shoku.
const UNIT_RATIOS: Record<Exclude<DiaryUnit, "points" | "serving">, number> = {
  g: 1,
  oz: 28.35,
  lb: 453.59,
  ml: 1,
  fl_oz: 29.57,
  tsp: 4.93,
  tbsp: 14.79,
  cup: 236.59,
}

/** Number of servings a quantity represents, or null for points (no nutrient breakdown). */
export function servingsFor(quantity: number, unit: DiaryUnit, servingSize: number): number | null {
  if (unit === "points") return null
  if (unit === "serving") return quantity
  return (quantity * UNIT_RATIOS[unit]) / servingSize
}

export function getCompatibleUnits(baseUnit: BaseUnit): DiaryUnit[] {
  return baseUnit === "ml" ? VOLUME_UNITS : MASS_UNITS
}

export function unitLabel(unit: DiaryUnit): string {
  return UNIT_LABELS[unit] ?? unit
}
