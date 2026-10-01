import { ObjectId, type Document, type WithId } from "mongodb"
import {
  getJournalEntriesCollection,
  getTrainerGuidanceCollection,
  getUsersCollection,
  getWeightLogCollection,
} from "./collections"
import { dateStrFromDate, getCalendarDays } from "./calendar"
import { getFastsCollection } from "./danjiki"
import { endOfDayTz, startOfDayTz } from "./dates"
import { getExercisesCollection, getWorkoutPlansCollection } from "./dojo"
import { getCommitmentsCollection, getPeriodHistory, getTaperDailyHistory, getTaperProgress } from "./kata"
import { getFoodItemLogsCollection, getFoodItemsCollection, getWaterLogCollection } from "./shoku"
import { ageFrom, htmlToText, section } from "./trainer"
import { geocodeZip } from "./weatherApi"

/** How many most-recent journey weeks get a weekly rollup and scorecard. */
const MAX_WEEKS = 16
/** How many most-recent days are sent in daily detail. */
const DETAIL_DAYS = 14
/** Journal text fields are truncated to keep the context compact. */
const MAX_NOTE_CHARS = 300

export function serializeGuidance(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    journeyId: doc.journeyId.toString(),
    date: doc.date,
    requestedAt: doc.requestedAt instanceof Date ? doc.requestedAt.toISOString() : doc.requestedAt,
    model: doc.model,
    messages: (doc.messages ?? []).map((m: any) => ({
      role: m.role,
      content: m.content,
      at: m.at instanceof Date ? m.at.toISOString() : m.at,
    })),
  }
}

// ── Calendar-date arithmetic on YYYY-MM-DD strings (no timezone involved) ──

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
}

/** Monday of the week containing `dateStr`. */
function mondayOf(dateStr: string): string {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return addDays(dateStr, -((dow + 6) % 7))
}

const round = (n: number, digits = 0) => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

function truncate(text: string | null | undefined): string | null {
  const t = htmlToText(text)
  if (!t) return null
  return t.length > MAX_NOTE_CHARS ? `${t.slice(0, MAX_NOTE_CHARS)}…` : t
}

/** Least-squares slope of weight over time, in lbs per week. */
function weeklyRate(entries: { date: string; weight: number }[]): number | null {
  if (entries.length < 3) return null
  const origin = entries[0].date
  const xs = entries.map((e) => daysBetween(origin, e.date))
  const ys = entries.map((e) => e.weight)
  const mx = avg(xs)!
  const my = avg(ys)!
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return (num / den) * 7
}

function proteinTargetGrams(shoku: any): number | null {
  const p = shoku?.macros?.protein
  if (p?.grams) return p.grams
  if (p?.percentage && shoku?.dailyCalorieTarget) return Math.round((p.percentage / 100) * shoku.dailyCalorieTarget / 4)
  return null
}

interface DayRollup {
  date: string
  foodLogged: boolean
  calories: number
  protein: number
  carbs: number
  fat: number
  waterOz: number
  workouts: any[]
  caloriesBurned: number
  fastHours: number
  fasts: { hours: number; targetHours: number | null }[]
  commitmentsMet: number
  commitmentsTotal: number
  weight: number | null
  sleepHours: number | null
  sleepQuality: number | null
  mood: number | null
  energy: number | null
  dayRating: number | null
}

/**
 * Renders the whole journey as a compact, rolled-up text block for the Guidance trainer:
 * the user's "why", every goal and setting, weekly rollups, a precomputed target scorecard,
 * weight trend with projection, habit adherence, the last two weeks in detail and the
 * previous guidance. Frozen onto the guidance record when it's created.
 */
export async function buildGuidanceContext(
  userId: ObjectId,
  journey: WithId<Document>,
  tz: string,
  today: string,
): Promise<string> {
  const now = new Date()
  const journeyStart = dateStrFromDate(new Date(journey.startDate), tz)
  const journeyEnd = dateStrFromDate(new Date(journey.endDate), tz)
  const lastDay = today < journeyEnd ? today : journeyEnd
  const hasData = lastDay >= journeyStart
  const windowStart = mondayOf(addDays(lastDay, -(MAX_WEEKS * 7 - 1)))
  const firstDay = journeyStart > windowStart ? journeyStart : windowStart
  const rangeStart = startOfDayTz(firstDay, tz)
  const rangeEnd = endOfDayTz(lastDay, tz)

  const shoku = journey.shokuTargets ?? null
  const danjiki = journey.danjikiTargets ?? null
  const dojo = journey.dojoTargets ?? null
  const planIds = (dojo?.planIds ?? []).map((id: any) => (id instanceof ObjectId ? id : new ObjectId(id)))
  const commitmentIds = (journey.kataTargets?.commitmentIds ?? []).map((id: any) =>
    id instanceof ObjectId ? id : new ObjectId(id),
  )

  const [user, calendar, foodLogs, waterLogs, fasts, journalEntries, weightEntries, plans, commitments, previous] =
    await Promise.all([
      getUsersCollection().then((col) => col.findOne({ _id: userId })),
      hasData
        ? getCalendarDays(userId, journey, tz, firstDay, lastDay)
        : Promise.resolve({ days: {} as Record<string, any>, tdee: null }),
      hasData
        ? getFoodItemLogsCollection().then((col) =>
            col
              .find(
                { userId, date: { $gte: rangeStart, $lte: rangeEnd } },
                { projection: { date: 1, calculatedProtein: 1, calculatedNetCarbs: 1, calculatedFat: 1 } },
              )
              .toArray(),
          )
        : [],
      hasData
        ? getWaterLogCollection().then((col) =>
            col.find({ userId, date: { $gte: firstDay, $lte: lastDay } }).toArray(),
          )
        : [],
      hasData
        ? getFastsCollection().then((col) =>
            col.find({ userId, status: "completed", endedAt: { $gte: rangeStart, $lte: rangeEnd } }).toArray(),
          )
        : [],
      hasData
        ? getJournalEntriesCollection().then((col) =>
            col.find({ userId, journeyId: journey._id, date: { $gte: firstDay, $lte: lastDay } }).toArray(),
          )
        : [],
      getWeightLogCollection().then((col) =>
        col.find({ userId, date: { $lte: lastDay }, weight: { $ne: null } }).sort({ date: 1 }).toArray(),
      ),
      planIds.length
        ? getWorkoutPlansCollection().then((col) => col.find({ _id: { $in: planIds }, userId }).toArray())
        : [],
      commitmentIds.length
        ? getCommitmentsCollection().then((col) => col.find({ _id: { $in: commitmentIds }, userId }).toArray())
        : [],
      getTrainerGuidanceCollection().then((col) =>
        col.findOne({ userId, journeyId: journey._id, date: { $lt: today } }, { sort: { date: -1 } }),
      ),
    ])

  // ── Daily rollups ──
  const days: Record<string, DayRollup> = {}
  if (hasData) {
    for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
      const c = calendar.days[d]
      days[d] = {
        date: d,
        foodLogged: false,
        calories: Math.round(c?.caloriesConsumed ?? 0),
        protein: 0,
        carbs: 0,
        fat: 0,
        waterOz: 0,
        workouts: c?.workouts ?? [],
        caloriesBurned: c?.caloriesBurned ?? 0,
        fastHours: 0,
        fasts: [],
        commitmentsMet: c?.commitmentsMet ?? 0,
        commitmentsTotal: c?.commitmentsTotal ?? commitmentIds.length,
        weight: c?.weight ?? null,
        sleepHours: null,
        sleepQuality: null,
        mood: c?.mood ?? null,
        energy: c?.energy ?? null,
        dayRating: c?.dayRating ?? null,
      }
    }
  }
  for (const log of foodLogs) {
    const day = days[dateStrFromDate(log.date, tz)]
    if (!day) continue
    day.foodLogged = true
    day.protein += log.calculatedProtein ?? 0
    day.carbs += log.calculatedNetCarbs ?? 0
    day.fat += log.calculatedFat ?? 0
  }
  for (const w of waterLogs) {
    if (days[w.date]) days[w.date].waterOz = w.ounces ?? 0
  }
  for (const f of fasts) {
    const day = days[dateStrFromDate(f.endedAt, tz)]
    if (!day) continue
    day.fastHours += f.actualDuration ?? 0
    day.fasts.push({ hours: round(f.actualDuration ?? 0, 1), targetHours: f.targetDuration ?? null })
  }
  for (const e of journalEntries) {
    const day = days[e.date]
    if (!day) continue
    day.sleepHours = e.morning?.sleepDuration ?? null
    day.sleepQuality = e.morning?.sleepQuality ?? null
  }
  for (const day of Object.values(days)) {
    day.protein = Math.round(day.protein)
    day.carbs = Math.round(day.carbs)
    day.fat = Math.round(day.fat)
  }

  // ── Weekly rollups and target scorecard ──
  const proteinTarget = proteinTargetGrams(shoku)
  const calorieTarget = shoku?.dailyCalorieTarget ?? null
  const waterTarget = shoku?.dailyWaterTargetOz ?? null
  const fastingTarget = danjiki?.weeklyFastingHours ?? null
  const sessionsTarget = dojo?.sessionsPerWeek ?? null
  const burnTarget = dojo?.weeklyCalorieBurn ?? null

  type WeekScore = { week: string; inProgress: boolean; [key: string]: unknown }
  const weeks: Record<string, unknown>[] = []
  const scorecard: Record<string, WeekScore[]> = {}
  const score = (key: string, entry: WeekScore) => (scorecard[key] ??= []).push(entry)

  if (hasData) {
    for (let monday = mondayOf(firstDay); monday <= lastDay; monday = addDays(monday, 7)) {
      const weekDays = Array.from({ length: 7 }, (_, i) => days[addDays(monday, i)]).filter(Boolean)
      if (!weekDays.length) continue
      const inProgress = addDays(monday, 6) > lastDay
      const n = weekDays.length
      const logged = weekDays.filter((d) => d.foodLogged)
      const workouts = weekDays.flatMap((d) => d.workouts)
      const fastsThisWeek = weekDays.flatMap((d) => d.fasts)
      const fastHours = round(weekDays.reduce((s, d) => s + d.fastHours, 0), 1)
      const burn = Math.round(weekDays.reduce((s, d) => s + d.caloriesBurned, 0))
      const sleep = weekDays.map((d) => d.sleepHours).filter((v): v is number => v != null)
      const sleepQ = weekDays.map((d) => d.sleepQuality).filter((v): v is number => v != null)
      const ratingOf = (k: "mood" | "energy" | "dayRating") =>
        avg(weekDays.map((d) => d[k]).filter((v): v is number => v != null))
      const commitmentSlots = weekDays.reduce((s, d) => s + d.commitmentsTotal, 0)
      const commitmentMet = weekDays.reduce((s, d) => s + d.commitmentsMet, 0)

      weeks.push({
        week: monday,
        days: n,
        inProgress,
        nutrition: {
          daysFoodLogged: logged.length,
          avgCalories: logged.length ? Math.round(avg(logged.map((d) => d.calories))!) : null,
          avgProtein: logged.length ? Math.round(avg(logged.map((d) => d.protein))!) : null,
          avgCarbs: logged.length ? Math.round(avg(logged.map((d) => d.carbs))!) : null,
          avgFat: logged.length ? Math.round(avg(logged.map((d) => d.fat))!) : null,
          avgWaterOz: Math.round(avg(weekDays.map((d) => d.waterOz))!),
        },
        workouts: {
          total: workouts.length,
          strength: workouts.filter((w) => w.type === "strength").length,
          cardio: workouts.filter((w) => w.type === "cardio").length,
          totalMinutes: workouts.reduce((s, w) => s + (w.durationMin ?? 0), 0),
          totalVolumeLbs: Math.round(workouts.reduce((s, w) => s + (w.totalVolume ?? 0), 0)),
          caloriesBurned: burn,
          sessionsWithPRs: workouts.filter((w) => w.hasPRs).length,
        },
        fasting: {
          fasts: fastsThisWeek.length,
          hours: fastHours,
          endedShortOfTarget: fastsThisWeek.filter((f) => f.targetHours != null && f.hours < f.targetHours).length,
        },
        habits: commitmentSlots ? { dailyCheckInsMetPct: Math.round((commitmentMet / commitmentSlots) * 100) } : null,
        recovery: {
          avgSleepHours: sleep.length ? round(avg(sleep)!, 1) : null,
          avgSleepQuality: sleepQ.length ? round(avg(sleepQ)!, 1) : null,
          avgMood: ratingOf("mood") != null ? round(ratingOf("mood")!, 1) : null,
          avgEnergy: ratingOf("energy") != null ? round(ratingOf("energy")!, 1) : null,
          avgDayRating: ratingOf("dayRating") != null ? round(ratingOf("dayRating")!, 1) : null,
          weighIns: weekDays.filter((d) => d.weight != null).length,
        },
      })

      // Daily targets: a week is met only if on target for all but at most one of its days. Unlogged days are
      // misses. Today is still underway, so it isn't scored.
      const scored = weekDays.filter((d) => d.date !== today)
      const scoredLogged = scored.filter((d) => d.foodLogged)
      const sn = scored.length
      const dailyMet = (onTarget: number) => onTarget >= Math.max(1, sn - 1)
      if (calorieTarget && sn) {
        const onTarget = scoredLogged.filter((d) => Math.abs(d.calories - calorieTarget) <= calorieTarget * 0.1).length
        const over = scoredLogged.filter((d) => d.calories > calorieTarget * 1.1).length
        score("dailyCalories", {
          week: monday, inProgress, target: calorieTarget, days: sn, daysLogged: scoredLogged.length,
          daysWithin10Pct: onTarget, daysOver: over, daysUnlogged: sn - scoredLogged.length, met: dailyMet(onTarget),
        })
      }
      if (proteinTarget && sn) {
        const onTarget = scoredLogged.filter((d) => d.protein >= proteinTarget * 0.9).length
        score("dailyProteinGrams", {
          week: monday, inProgress, target: proteinTarget, days: sn, daysAtLeast90Pct: onTarget,
          daysUnlogged: sn - scoredLogged.length, met: dailyMet(onTarget),
        })
      }
      if (waterTarget && sn) {
        const onTarget = scored.filter((d) => d.waterOz >= waterTarget).length
        score("dailyWaterOz", { week: monday, inProgress, target: waterTarget, days: sn, daysMet: onTarget, met: dailyMet(onTarget) })
      }
      if (fastingTarget) {
        score("weeklyFastingHours", { week: monday, inProgress, target: fastingTarget, actual: fastHours, met: fastHours >= fastingTarget })
      }
      if (sessionsTarget) {
        score("weeklyWorkoutSessions", { week: monday, inProgress, target: sessionsTarget, actual: workouts.length, met: workouts.length >= sessionsTarget })
      }
      if (burnTarget) {
        score("weeklyCalorieBurn", { week: monday, inProgress, target: burnTarget, actual: burn, met: burn >= burnTarget })
      }
    }
  }

  const scorecardSummary = Object.fromEntries(
    Object.entries(scorecard).map(([key, entries]) => {
      const complete = entries.filter((e) => !e.inProgress)
      return [key, { weeksMet: complete.filter((e) => e.met).length, completeWeeks: complete.length, weeks: entries }]
    }),
  )

  // ── Weight trend ──
  const weights = weightEntries.map((e) => ({ date: e.date as string, weight: e.weight as number }))
  const startingWeight =
    [...weights].reverse().find((e) => e.date <= journeyStart) ?? weights.find((e) => e.date >= journeyStart) ?? null
  const latest = weights.at(-1) ?? null
  const recent = weights.filter((e) => e.date >= addDays(lastDay, -27))
  const rate = weeklyRate(recent)
  const targetWeight = shoku?.targetWeight ?? null
  let projectedTargetDate: string | null = null
  if (rate && latest && targetWeight != null) {
    const remaining = targetWeight - latest.weight
    if (remaining !== 0 && Math.sign(remaining) === Math.sign(rate)) {
      projectedTargetDate = addDays(latest.date, Math.round((remaining / rate) * 7))
    }
  }
  const weeklyWeights = Object.entries(
    weights
      .filter((e) => e.date >= journeyStart)
      .reduce<Record<string, number[]>>((acc, e) => ((acc[mondayOf(e.date)] ??= []).push(e.weight), acc), {}),
  ).map(([week, ws]) => ({ week, avgWeight: round(avg(ws)!, 1), weighIns: ws.length }))

  // ── Habits ──
  const habits = await Promise.all(
    commitments.map(async (c) => {
      const base = {
        name: c.name,
        description: c.description ?? null,
        type: c.type ?? null,
        direction: c.direction ?? null,
        period: c.period ?? null,
        target: c.targetValue ?? null,
        unit: c.unit ?? null,
        status: c.status ?? null,
      }
      if (c.type === "taper" && c.taperPhases?.length && c.startDate) {
        const start = new Date(c.startDate)
        const [progress, history] = await Promise.all([
          getTaperProgress(c._id, userId, start, c.taperPhases, c.status ?? "active", now),
          getTaperDailyHistory(c._id, userId, start, c.taperPhases),
        ])
        const inJourney = history.filter((h) => h.date >= journeyStart && h.date <= lastDay)
        return {
          ...base,
          taper: {
            phases: c.taperPhases.map((p: any) => ({ week: p.weekNumber, label: p.label, dailyLimit: p.dailyLimit })),
            currentPhase: progress.currentPhase,
            status: progress.status,
            last30DaysWithinLimit: `${inJourney.filter((h) => h.met).length}/${inJourney.length}`,
            recentDays: inJourney.slice(-DETAIL_DAYS).map((h) => ({ date: h.date, value: h.value, limit: h.dailyLimit })),
          },
        }
      }
      if (!c.period || c.targetValue == null) return base
      const { periods, journeyTotal } = await getPeriodHistory(
        c._id, userId, c.period, c.targetValue, c.direction ?? "achieve", new Date(journey.startDate),
      )
      if (journeyTotal) return { ...base, journeyTotalSoFar: journeyTotal.cumulativeTotal }
      const inJourney = periods.filter((p) => p.end.slice(0, 10) >= journeyStart && p.start.slice(0, 10) <= lastDay)
      return {
        ...base,
        periodsMet: `${inJourney.filter((p) => p.met).length}/${inJourney.length}`,
        periods: inJourney.slice(-8).map((p) => ({ period: p.label, value: p.value, met: p.met })),
      }
    }),
  )

  // ── Settings that need names resolved ──
  const exerciseIds = plans.flatMap((p) => (p.sessions ?? []).flatMap((s: any) => (s.exercises ?? []).map((e: any) => e.exerciseId)))
  const mealBuilds = journey.shokuMealBuilds ?? []
  const foodIds = mealBuilds.flatMap((b: any) =>
    ["breakfast", "lunch", "dinner", "snack"].flatMap((meal) => (b.meals?.[meal] ?? []).map((i: any) => i.foodItemId)),
  )
  const [exerciseDocs, foodDocs] = await Promise.all([
    exerciseIds.length
      ? getExercisesCollection().then((col) => col.find({ _id: { $in: exerciseIds } }, { projection: { name: 1 } }).toArray())
      : [],
    foodIds.length
      ? getFoodItemsCollection().then((col) => col.find({ _id: { $in: foodIds } }, { projection: { name: 1 } }).toArray())
      : [],
  ])
  const exerciseName = new Map(exerciseDocs.map((e) => [e._id.toString(), e.name]))
  const foodName = new Map(foodDocs.map((f) => [f._id.toString(), f.name]))

  const profile = user?.profile ?? {}
  const place = profile.zipCode ? await geocodeZip(profile.zipCode) : null
  const totalDays = daysBetween(journeyStart, journeyEnd) + 1
  const dayNumber = Math.min(Math.max(daysBetween(journeyStart, today) + 1, 0), totalDays)

  const goals = {
    journey: {
      name: journey.name,
      description: journey.description ?? null,
      startDate: journeyStart,
      endDate: journeyEnd,
      day: `${dayNumber} of ${totalDays}`,
      daysLeft: Math.max(daysBetween(today, journeyEnd), 0),
    },
    nutrition: shoku
      ? {
          ...shoku,
          proteinTargetGrams: proteinTarget,
          mealBuilds: mealBuilds.map((b: any) => ({
            name: b.name,
            meals: Object.fromEntries(
              ["breakfast", "lunch", "dinner", "snack"].map((meal) => [
                meal,
                (b.meals?.[meal] ?? []).map((i: any) => foodName.get(i.foodItemId?.toString()) ?? "Unknown food"),
              ]),
            ),
          })),
        }
      : "not configured",
    fasting: danjiki ?? "not configured",
    workouts: dojo
      ? {
          sessionsPerWeek: dojo.sessionsPerWeek ?? null,
          weeklyCalorieBurn: dojo.weeklyCalorieBurn ?? null,
          plans: plans.map((p) => ({
            name: p.name,
            sessions: (p.sessions ?? []).map((s: any) => ({
              name: s.name,
              type: s.type ?? "strength",
              targetDayOfWeek: s.targetDayOfWeek ?? null,
              exercises: (s.exercises ?? []).map((e: any) => ({
                name: exerciseName.get(e.exerciseId?.toString()) ?? "Unknown",
                sets: e.targetSets ?? null,
                reps: e.targetReps ?? null,
                weight: e.targetWeight ?? null,
              })),
            })),
          })),
        }
      : "not configured",
    habits: commitments.length ? `${commitments.length} habits — see Habit adherence` : "not configured",
  }

  const detailStart = addDays(lastDay, -(DETAIL_DAYS - 1))
  const journalByDate = new Map(journalEntries.map((e) => [e.date, e]))
  const recentDays = Object.values(days)
    .filter((d) => d.date >= detailStart)
    .map((d) => {
      const j = journalByDate.get(d.date)
      return {
        date: d.date,
        food: d.foodLogged ? { calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat } : "nothing logged",
        waterOz: d.waterOz,
        workouts: d.workouts.map((w: any) => ({
          name: w.sessionName,
          type: w.type,
          minutes: w.durationMin,
          volumeLbs: w.totalVolume,
          reps: w.totalReps,
          distance: w.cardioDistance,
          caloriesBurned: w.caloriesBurned,
          prs: w.hasPRs,
        })),
        fasts: d.fasts,
        habitsMet: d.commitmentsTotal ? `${d.commitmentsMet}/${d.commitmentsTotal}` : null,
        weight: d.weight,
        sleep: { hours: d.sleepHours, quality: d.sleepQuality },
        mood: d.mood,
        energy: d.energy,
        dayRating: d.dayRating,
        journal: j
          ? {
              morningNotes: truncate(j.morning?.notes),
              highlights: truncate(j.evening?.highlights),
              challenges: truncate(j.evening?.challenges),
              intention: truncate(j.evening?.intention),
              eveningNotes: truncate(j.evening?.notes),
            }
          : null,
      }
    })

  const previousAdvice = (previous?.messages ?? []).find((m: any) => m.role === "assistant")
  const why = htmlToText(journey.statement)

  const parts = [
    `# Journey guidance context for ${today} (timezone ${tz})`,
    "Weeks start on Monday and are labelled by their Monday date. Today is still underway: it is excluded from daily-target scoring and its nutrition totals are partial. Weights are in lbs, water in oz, fasting and sleep in hours, workout volume in lbs. Ratings are 1–5. Day-of-week numbers use 0 = Sunday. Weeks marked inProgress are partial and not counted in weeksMet.",
    section("Profile", {
      firstName: profile.firstName ?? null,
      age: ageFrom(profile.birthDate, now),
      sex: profile.sex ?? null,
      heightIn: profile.height ?? null,
      profileWeight: profile.weight ?? null,
      location: profile.zipCode ? { place: place?.placeName ?? null, zipCode: profile.zipCode } : null,
      activityLevel: profile.activityLevel ?? null,
      tdee: calendar.tdee,
    }),
    `## Why this journey matters (the user's goal)\n${why ?? "The user hasn't written why this journey matters. Point out that a clear goal is missing."}`,
    section("Journey goals and settings", goals),
    section("Weight trend", {
      startingWeight,
      latest,
      targetWeight,
      goalLbsPerWeek: shoku?.weightGoalLbsPerWeek ?? null,
      actualLbsPerWeekLast4Weeks: rate != null ? round(rate, 2) : null,
      weighInsLast4Weeks: recent.length,
      projectedTargetDateAtCurrentRate: projectedTargetDate,
      journeyEndDate: journeyEnd,
      weeklyAverages: weeklyWeights.slice(-MAX_WEEKS),
    }),
    hasData
      ? section(`Target scorecard (${firstDay} to ${lastDay})`, scorecardSummary)
      : "## Target scorecard\nThe journey hasn't started yet.",
    hasData ? section("Weekly rollups", weeks) : "",
    commitments.length ? section("Habit adherence", habits) : "",
    hasData ? section(`Last ${DETAIL_DAYS} days in detail`, recentDays) : "",
    previous && previousAdvice
      ? `## Previous guidance (${previous.date})\nCheck whether the user acted on this.\n\n${previousAdvice.content}`
      : "## Previous guidance\nNone — this is the first guidance for this journey.",
  ]
  return parts.filter(Boolean).join("\n\n")
}
