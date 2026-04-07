import { getFoodItemLogsCollection, getWaterLogCollection, serializeFoodItemLog } from "$lib/server/shoku"
import { startOfDayTz, endOfDayTz, todayStr } from "$lib/server/dates"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) return { grouped: {}, totals: { calories: 0, protein: 0, netCarbs: 0, fat: 0 }, waterOunces: 0 }

  const userTz = locals.userTimezone ?? "America/Los_Angeles"
  const dateStr = url.searchParams.get("date") ?? todayStr(userTz)
  const dayStart = startOfDayTz(dateStr, userTz)
  const dayEnd = endOfDayTz(dateStr, userTz)

  const filter: Record<string, unknown> = {
    userId: new ObjectId(locals.userId),
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
    userId: new ObjectId(locals.userId),
    date: dateStr,
  })
  const waterOunces = waterDoc?.ounces ?? 0

  return { grouped, totals, date: dateStr, waterOunces }
}
