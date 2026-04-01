import { getDiaryEntriesCollection, serializeDiaryEntry } from "$lib/server/shoku"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) return { grouped: {}, totals: { calories: 0, protein: 0, netCarbs: 0, fat: 0 } }

  const dateStr = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0]
  const date = new Date(dateStr + "T00:00:00.000Z")
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)

  const filter: Record<string, unknown> = {
    userId: new ObjectId(locals.userId),
    date: { $gte: date, $lt: nextDate },
  }

  const journeyId = url.searchParams.get("journeyId")
  if (journeyId) {
    filter.journeyIds = new ObjectId(journeyId)
  }

  const diaryEntries = await getDiaryEntriesCollection()
  const entries = await diaryEntries.find(filter).sort({ loggedAt: 1 }).toArray()
  const serialized = entries.map(serializeDiaryEntry)

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

  return { grouped, totals, date: dateStr }
}
