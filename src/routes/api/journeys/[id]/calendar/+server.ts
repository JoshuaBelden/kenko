import { getJourneysCollection, getWeightLogCollection, getJournalEntriesCollection } from "$lib/server/collections"
import { getFastsCollection } from "$lib/server/danjiki"
import { startOfDayTz, endOfDayTz } from "$lib/server/dates"
import { getWorkoutLogsCollection } from "$lib/server/dojo"
import { getCommitmentsCollection, getCommitmentLogsCollection } from "$lib/server/kata"
import { getFoodItemLogsCollection } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

function dateStrFromDate(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(d)
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)
  const userTz = locals.userTimezone ?? "America/Los_Angeles"

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  // Parse month param (YYYY-MM)
  const monthParam = url.searchParams.get("month")
  const now = new Date()
  let year: number, month: number
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    ;[year, month] = monthParam.split("-").map(Number)
  } else {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: userTz, year: "numeric", month: "2-digit" })
    const parts = fmt.format(now).split("-")
    year = Number(parts[0])
    month = Number(parts[1])
  }

  // Build date range for the month
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`

  const monthStart = startOfDayTz(firstDay, userTz)
  const monthEnd = endOfDayTz(lastDay, userTz)

  // Journey commitment IDs
  const commitmentIds = (journey.kataTargets?.commitmentIds ?? []).map((id: any) =>
    id instanceof ObjectId ? id : new ObjectId(id),
  )

  // Run all queries in parallel
  const [
    workoutLogs,
    fasts,
    journalEntries,
    commitmentLogs,
    weightEntries,
    foodItemLogs,
    commitmentDocs,
  ] = await Promise.all([
    getWorkoutLogsCollection().then((col) =>
      col
        .find({
          userId,
          status: "completed",
          completedAt: { $gte: monthStart, $lte: monthEnd },
        })
        .toArray(),
    ),
    getFastsCollection().then((col) =>
      col
        .find({
          userId,
          journeyIds: journeyId,
          status: "completed",
          endedAt: { $gte: monthStart, $lte: monthEnd },
        })
        .toArray(),
    ),
    getJournalEntriesCollection().then((col) =>
      col
        .find({
          userId,
          journeyId,
          date: { $gte: firstDay, $lte: lastDay },
        })
        .toArray(),
    ),
    commitmentIds.length > 0
      ? getCommitmentLogsCollection().then((col) =>
          col
            .find({
              userId,
              commitmentId: { $in: commitmentIds },
              date: { $gte: monthStart, $lte: monthEnd },
            })
            .toArray(),
        )
      : Promise.resolve([]),
    getWeightLogCollection().then((col) =>
      col
        .find({
          userId,
          date: { $gte: firstDay, $lte: lastDay },
        })
        .toArray(),
    ),
    getFoodItemLogsCollection().then((col) =>
      col
        .find({
          userId,
          date: { $gte: monthStart, $lte: monthEnd },
        })
        .toArray(),
    ),
    commitmentIds.length > 0
      ? getCommitmentsCollection().then((col) =>
          col.find({ _id: { $in: commitmentIds }, userId }).toArray(),
        )
      : Promise.resolve([]),
  ])

  const totalCommitments = commitmentDocs.length

  // Aggregate by day
  const days: Record<string, any> = {}

  function ensureDay(dateStr: string) {
    if (!days[dateStr]) {
      days[dateStr] = {
        workouts: [],
        fastCount: 0,
        fastHours: 0,
        dayRating: null,
        morningNotes: null,
        eveningNotes: null,
        mood: null,
        energy: null,
        commitmentsMet: 0,
        commitmentsTotal: totalCommitments,
        weight: null,
        caloriesConsumed: 0,
        caloriesBurned: 0,
      }
    }
    return days[dateStr]
  }

  // Workouts
  for (const log of workoutLogs) {
    const d = dateStrFromDate(log.completedAt, userTz)
    const day = ensureDay(d)
    const sessionType = log.planSnapshot?.sessionType ?? "strength"
    day.workouts.push({
      logId: log._id.toString(),
      sessionName: log.planSnapshot?.sessionName ?? "Workout",
      type: sessionType,
      totalVolume: log.performance?.totalVolume ?? 0,
      totalReps: log.performance?.totalReps ?? 0,
      cardioDistance: log.cardioDistance ?? null,
      caloriesBurned: log.caloriesBurned ?? 0,
      hasPRs: (log.performance?.exercisePerformance ?? []).some(
        (ep: any) => (ep.personalBests ?? []).length > 0,
      ),
    })
    day.caloriesBurned += log.caloriesBurned ?? 0
  }

  // Fasts
  for (const fast of fasts) {
    const d = dateStrFromDate(fast.endedAt, userTz)
    const day = ensureDay(d)
    day.fastCount++
    day.fastHours += fast.actualDuration ?? 0
  }

  // Journal entries
  for (const entry of journalEntries) {
    const day = ensureDay(entry.date)
    day.dayRating = entry.evening?.dayRating ?? day.dayRating
    day.mood = entry.evening?.mood ?? day.mood
    day.energy = entry.evening?.energy ?? day.energy
    day.morningNotes = entry.morning?.notes ?? day.morningNotes
    day.eveningNotes = entry.evening?.notes ?? day.eveningNotes
  }

  // Commitment logs — count distinct commitments met per day
  const commitmentsByDay = new Map<string, Set<string>>()
  for (const log of commitmentLogs) {
    const d = dateStrFromDate(log.date, userTz)
    ensureDay(d)
    if (!commitmentsByDay.has(d)) commitmentsByDay.set(d, new Set())
    if (log.value > 0) commitmentsByDay.get(d)!.add(log.commitmentId.toString())
  }
  for (const [d, ids] of commitmentsByDay) {
    days[d].commitmentsMet = ids.size
  }

  // Weight entries
  for (const entry of weightEntries) {
    const day = ensureDay(entry.date)
    day.weight = entry.weight
  }

  // Food item logs
  for (const entry of foodItemLogs) {
    const d = dateStrFromDate(entry.date, userTz)
    const day = ensureDay(d)
    day.caloriesConsumed += entry.calculatedCalories ?? 0
  }

  // Calculate net calories for each day
  for (const d of Object.keys(days)) {
    const day = days[d]
    if (day.caloriesConsumed > 0 || day.caloriesBurned > 0) {
      day.netCalories = day.caloriesConsumed - day.caloriesBurned
    } else {
      day.netCalories = null
    }
  }

  return json({ year, month, days })
}
