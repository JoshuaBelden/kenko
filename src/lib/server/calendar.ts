import { getWeightLogCollection, getJournalEntriesCollection, getUsersCollection } from "$lib/server/collections"
import { getFastsCollection } from "$lib/server/danjiki"
import { startOfDayTz, endOfDayTz } from "$lib/server/dates"
import { getWorkoutLogsCollection } from "$lib/server/dojo"
import { getCommitmentsCollection, getCommitmentLogsCollection } from "$lib/server/kata"
import { getFoodItemLogsCollection } from "$lib/server/shoku"
import { calculateTdee } from "$lib/server/tdee"
import { ObjectId, type Document, type WithId } from "mongodb"

export function dateStrFromDate(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(d)
}

/**
 * Builds the per-day Progress data (workouts, fasts, journal, commitments, weight, calories)
 * for a journey between two inclusive YYYY-MM-DD dates in the user's timezone.
 * Shared by the calendar API and the AI Trainer.
 */
export async function getCalendarDays(
  userId: ObjectId,
  journey: WithId<Document>,
  userTz: string,
  firstDay: string,
  lastDay: string,
): Promise<{ days: Record<string, any>; tdee: number | null }> {
  const rangeStart = startOfDayTz(firstDay, userTz)
  const rangeEnd = endOfDayTz(lastDay, userTz)
  const journeyId = journey._id

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
    userDoc,
  ] = await Promise.all([
    getWorkoutLogsCollection().then((col) =>
      col
        .find({
          userId,
          status: "completed",
          completedAt: { $gte: rangeStart, $lte: rangeEnd },
        })
        .toArray(),
    ),
    getFastsCollection().then((col) =>
      col
        .find({
          userId,
          status: "completed",
          endedAt: { $gte: rangeStart, $lte: rangeEnd },
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
              date: { $gte: rangeStart, $lte: rangeEnd },
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
          date: { $gte: rangeStart, $lte: rangeEnd },
        })
        .toArray(),
    ),
    commitmentIds.length > 0
      ? getCommitmentsCollection().then((col) =>
          col.find({ _id: { $in: commitmentIds }, userId }).toArray(),
        )
      : Promise.resolve([]),
    getUsersCollection().then((col) => col.findOne({ _id: userId })),
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
        weather: null,
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
    const durationMin =
      log.startedAt && log.completedAt
        ? Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 60000)
        : null
    day.workouts.push({
      logId: log._id.toString(),
      sessionName: log.planSnapshot?.sessionName ?? "Workout",
      type: sessionType,
      totalVolume: log.performance?.totalVolume ?? 0,
      totalReps: log.performance?.totalReps ?? 0,
      cardioDistance: log.cardioDistance ?? null,
      caloriesBurned: log.caloriesBurned ?? 0,
      durationMin,
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
    day.weather = entry.weather ?? day.weather
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

  // Compute effective TDEE
  let effectiveTdee: number | null = null
  const p = userDoc?.profile
  if (p?.tdeeOverride) {
    effectiveTdee = p.tdeeOverride
  } else if (p?.weight && p?.height && p?.sex && p?.birthDate && p?.activityLevel) {
    effectiveTdee = calculateTdee({
      weightLbs: p.weight,
      heightIn: p.height,
      sex: p.sex,
      birthDate: p.birthDate,
      activityLevel: p.activityLevel,
    }).tdee
  }

  // Calculate net calories for each day (consumed - TDEE - workout burn)
  for (const d of Object.keys(days)) {
    const day = days[d]
    if (effectiveTdee != null && day.caloriesConsumed > 0) {
      day.netCalories = Math.round(day.caloriesConsumed - effectiveTdee - day.caloriesBurned)
    } else {
      day.netCalories = null
    }
  }

  return { days, tdee: effectiveTdee }
}
