import { getFoodItemLogsCollection, getFoodItemsCollection, getMealBuildLogCollection, getWaterLogCollection, serializeFoodItemLog } from "$lib/server/shoku"
import { getJourneysCollection } from "$lib/server/collections"
import { startOfDayTz, endOfDayTz, todayStr } from "$lib/server/dates"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) return { grouped: {}, totals: { calories: 0, protein: 0, netCarbs: 0, fat: 0 }, waterOunces: 0, mealBuilds: [], selectedMealBuild: null }

  const userId = new ObjectId(locals.userId)
  const userTz = locals.userTimezone ?? "America/Los_Angeles"
  const dateStr = url.searchParams.get("date") ?? todayStr(userTz)
  const dayStart = startOfDayTz(dateStr, userTz)
  const dayEnd = endOfDayTz(dateStr, userTz)

  const filter: Record<string, unknown> = {
    userId,
    date: { $gte: dayStart, $lte: dayEnd },
  }

  const foodItemLogs = await getFoodItemLogsCollection()
  const entries = await foodItemLogs.find(filter).sort({ loggedAt: 1 }).toArray()
  const serialized = entries.map(serializeFoodItemLog)

  const grouped: Record<string, typeof serialized> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    uncategorized: [],
  }
  let totals = { calories: 0, protein: 0, netCarbs: 0, fat: 0 }

  for (const entry of serialized) {
    const cat = entry.category in grouped ? entry.category : "uncategorized"
    grouped[cat].push(entry)
    totals.calories += entry.calculatedCalories
    totals.protein += entry.calculatedProtein
    totals.netCarbs += entry.calculatedNetCarbs
    totals.fat += entry.calculatedFat
  }

  totals.protein = Math.round(totals.protein * 10) / 10
  totals.netCarbs = Math.round(totals.netCarbs * 10) / 10
  totals.fat = Math.round(totals.fat * 10) / 10

  const waterLog = await getWaterLogCollection()
  const waterDoc = await waterLog.findOne({
    userId,
    date: dateStr,
  })
  const waterOunces = waterDoc?.ounces ?? 0

  // Load meal builds from active journey
  let mealBuilds: { id: string; name: string }[] = []
  let selectedMealBuild: any = null
  let activeJourneyId: string | null = null

  const now = new Date()
  const journeysCol = await getJourneysCollection()
  const activeJourney = await journeysCol.findOne({
    userId,
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  })

  if (activeJourney?.shokuMealBuilds?.length) {
    activeJourneyId = activeJourney._id.toString()
    mealBuilds = activeJourney.shokuMealBuilds.map((b: any) => ({
      id: (b._id ?? b.id).toString(),
      name: b.name,
    }))

    // Check for persisted meal build selection
    const mealBuildLogCol = await getMealBuildLogCollection()
    const mealBuildDoc = await mealBuildLogCol.findOne({ userId, date: dateStr })
    const selectedId = mealBuildDoc?.mealBuildId?.toString() ?? null

    if (selectedId) {
      const build = activeJourney.shokuMealBuilds.find(
        (b: any) => (b._id ?? b.id).toString() === selectedId,
      )
      if (build) {
        // Collect all foodItemIds across all meals
        const allFoodIds = new Set<string>()
        for (const meal of ["breakfast", "lunch", "dinner", "snack"]) {
          for (const item of build.meals?.[meal] ?? []) {
            allFoodIds.add(item.foodItemId.toString())
          }
        }

        // Resolve food items
        const foodsCol = await getFoodItemsCollection()
        const foodDocs = await foodsCol
          .find({ _id: { $in: [...allFoodIds].map((id) => new ObjectId(id)) } })
          .toArray()
        const foodMap = new Map(foodDocs.map((f) => [f._id.toString(), f]))

        // Build the resolved structure
        const resolveMealItems = (items: any[]) =>
          (items ?? [])
            .map((item: any) => {
              const food = foodMap.get(item.foodItemId.toString())
              if (!food) return null
              return {
                foodItemId: item.foodItemId.toString(),
                foodName: food.name,
                servingSize: item.servingSize ?? 1,
                servingUnit: item.servingUnit ?? "serving",
                macroType: item.macroType,
                calories: food.calories ?? 0,
                protein: food.protein ?? 0,
                netCarbs: food.netCarbs ?? 0,
                fat: food.fat ?? 0,
              }
            })
            .filter(Boolean)

        selectedMealBuild = {
          id: (build._id ?? build.id).toString(),
          name: build.name,
          meals: {
            breakfast: resolveMealItems(build.meals?.breakfast),
            lunch: resolveMealItems(build.meals?.lunch),
            dinner: resolveMealItems(build.meals?.dinner),
            snack: resolveMealItems(build.meals?.snack),
          },
        }
      }
    }
  }

  // Extract macro targets from active journey
  let macroTargets: { calories: number | null; protein: number | null; netCarbs: number | null; fat: number | null; waterOz: number | null } | null = null
  if (activeJourney?.shokuTargets) {
    const st = activeJourney.shokuTargets
    const calTarget = st.dailyCalorieTarget ?? null

    // Resolve macro grams: use grams directly, or calculate from percentage of calorie target
    const resolveMacroGrams = (macro: any, calPerGram: number): number | null => {
      if (!macro) return null
      if (macro.grams != null) return macro.grams
      if (macro.percentage != null && calTarget != null) {
        return Math.round((calTarget * macro.percentage / 100) / calPerGram)
      }
      return null
    }

    macroTargets = {
      calories: calTarget,
      protein: resolveMacroGrams(st.macros?.protein, 4),
      netCarbs: resolveMacroGrams(st.macros?.carbs, 4),
      fat: resolveMacroGrams(st.macros?.fat, 9),
      waterOz: st.dailyWaterTargetOz ?? null,
    }
  }

  return { grouped, totals, date: dateStr, waterOunces, mealBuilds, selectedMealBuild, activeJourneyId, macroTargets }
}
