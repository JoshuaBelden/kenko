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

export function getCompatibleUnits(baseUnit: BaseUnit): DiaryUnit[] {
  return baseUnit === "ml" ? VOLUME_UNITS : MASS_UNITS
}

export function unitLabel(unit: DiaryUnit): string {
  return UNIT_LABELS[unit] ?? unit
}
