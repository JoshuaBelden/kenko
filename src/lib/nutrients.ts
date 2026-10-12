/**
 * Additional (non-macro) nutrients stored per serving on food items.
 */

export const ADDITIONAL_NUTRIENTS = [
  { key: "saturatedFat", label: "Saturated Fat", unit: "g" },
  { key: "transFat", label: "Trans Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "addedSugars", label: "Added Sugars", unit: "g" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
  { key: "sodium", label: "Sodium", unit: "mg" },
  { key: "iron", label: "Iron", unit: "mg" },
  { key: "calcium", label: "Calcium", unit: "mg" },
  { key: "magnesium", label: "Magnesium", unit: "mg" },
  { key: "vitaminA", label: "Vitamin A", unit: "" },
  { key: "vitaminC", label: "Vitamin C", unit: "mg" },
  { key: "vitaminB12", label: "Vitamin B12", unit: "" },
  { key: "vitaminE", label: "Vitamin E", unit: "mg" },
  { key: "vitaminK", label: "Vitamin K", unit: "" },
  { key: "folate", label: "Folate", unit: "" },
  { key: "potassium", label: "Potassium", unit: "mg" },
  { key: "zinc", label: "Zinc", unit: "mg" },
] as const

export type AdditionalNutrientKey = (typeof ADDITIONAL_NUTRIENTS)[number]["key"]

export const ADDITIONAL_NUTRIENT_KEYS: AdditionalNutrientKey[] = ADDITIONAL_NUTRIENTS.map((n) => n.key)
