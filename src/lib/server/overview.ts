import { getWeightLogCollection } from "$lib/server/collections"
import { getFastsCollection } from "$lib/server/danjiki"
import { startOfDayTz, endOfDayTz, startOfWeekTz, endOfWeekTz, todayStr, dayOfWeekTz } from "$lib/server/dates"
import { getWorkoutLogsCollection, getWorkoutPlansCollection, serializeWorkoutPlan, getTodaysCaloriesBurned } from "$lib/server/dojo"
import { getCommitmentsCollection, getCommitmentLogsCollection, serializeCommitment, calculateTaperPhaseInfo } from "$lib/server/kata"
import { getFoodItemLogsCollection, getWaterLogCollection } from "$lib/server/shoku"
import { ObjectId, type Document, type WithId } from "mongodb"

/**
 * Builds the Journey dashboard data (Nutrition, Fasting, Workout, Habits, Weight) for a journey.
 * Shared by the overview API and the AI Trainer so both see the same numbers.
 */
export async function getJourneyOverview(
  userId: ObjectId,
  journey: WithId<Document>,
  userTz: string,
  now: Date = new Date(),
): Promise<Record<string, any>> {
  const today = todayStr(userTz)
  const todayStart = startOfDayTz(today, userTz)
  const todayEnd = endOfDayTz(today, userTz)
  const weekStart = startOfWeekTz(now, userTz)
  const weekEnd = endOfWeekTz(now, userTz)

  const result: Record<string, any> = {}

  // Nutrition data
  if (journey.shokuTargets) {
    const foodItemLogs = await getFoodItemLogsCollection()
    const todayEntries = await foodItemLogs
      .find({
        userId,
        date: { $gte: todayStart, $lte: todayEnd },
      })
      .toArray()

    const totals = todayEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calculatedCalories ?? 0),
        protein: acc.protein + (e.calculatedProtein ?? 0),
        carbs: acc.carbs + (e.calculatedNetCarbs ?? 0),
        fat: acc.fat + (e.calculatedFat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    )

    const waterLog = await getWaterLogCollection()
    const waterEntry = await waterLog.findOne({ userId, date: today })
    const caloriesBurnedToday = await getTodaysCaloriesBurned(userId, todayStart, todayEnd)

    result.shoku = {
      totals,
      waterOz: waterEntry?.ounces ?? 0,
      caloriesBurnedToday,
    }
  }

  // Fasting data
  if (journey.danjikiTargets) {
    const fasts = await getFastsCollection()

    // Weekly completed fasting hours
    const weekFasts = await fasts
      .find({
        userId,
        status: "completed",
        endedAt: { $gte: weekStart, $lte: weekEnd },
      })
      .toArray()

    const weeklyHours = weekFasts.reduce((sum, f) => sum + (f.actualDuration ?? 0), 0)

    // Active fast
    const activeFast = await fasts.findOne({ userId, status: "running" })

    result.danjiki = {
      weeklyHoursFasted: Math.round(weeklyHours * 10) / 10,
      activeFast: activeFast
        ? {
            startedAt: activeFast.startedAt instanceof Date ? activeFast.startedAt.toISOString() : activeFast.startedAt,
            targetDuration: activeFast.targetDuration,
          }
        : null,
    }
  }

  // Workout data
  if (journey.dojoTargets) {
    const logs = await getWorkoutLogsCollection()

    const planIds = (journey.dojoTargets.planIds ?? []).map((id: any) =>
      id instanceof ObjectId ? id : new ObjectId(id),
    )

    const weekLogQuery: Record<string, unknown> = {
      userId,
      status: "completed",
      completedAt: { $gte: weekStart, $lte: weekEnd },
    }
    if (planIds.length > 0) {
      // Manual cardio entries have no plan, so always count them
      weekLogQuery.$or = [{ planId: { $in: planIds } }, { planId: null }]
    }

    const weekLogs = await logs.find(weekLogQuery).toArray()

    const sessionsThisWeek = weekLogs.length
    const weeklyCaloriesBurned = weekLogs.reduce(
      (sum, log) => sum + (log.caloriesBurned ?? 0),
      0,
    )

    // Get upcoming sessions from selected plans
    const plans = await getWorkoutPlansCollection()
    const selectedPlans = planIds.length > 0
      ? await plans.find({ _id: { $in: planIds }, userId }).toArray()
      : []

    // Target days are suggestions: any completed log this week for a plan's
    // session crosses it off, regardless of which day it was recorded. Logs are
    // counted per plan+session name so a session listed twice in a plan needs
    // two logs to cross off both.
    const remaining = new Map<string, number>()
    for (const l of weekLogs) {
      const key = `${l.planId?.toString()}::${l.planSnapshot?.sessionName}`
      remaining.set(key, (remaining.get(key) ?? 0) + 1)
    }

    const todayDow = dayOfWeekTz(now, userTz)
    const upcoming: Array<{ planName: string; sessionName: string; targetDay: number | null; completed: boolean }> = []
    for (const plan of selectedPlans) {
      for (const session of plan.sessions ?? []) {
        const key = `${plan._id.toString()}::${session.name}`
        const left = remaining.get(key) ?? 0
        const completed = left > 0
        if (completed) remaining.set(key, left - 1)
        upcoming.push({
          planName: plan.name,
          sessionName: session.name,
          targetDay: session.targetDayOfWeek ?? null,
          completed,
        })
      }
    }

    // Sort: today first, then future days this week, then unscheduled
    upcoming.sort((a, b) => {
      if (a.targetDay === null && b.targetDay === null) return 0
      if (a.targetDay === null) return 1
      if (b.targetDay === null) return -1
      const aDist = (a.targetDay - todayDow + 7) % 7
      const bDist = (b.targetDay - todayDow + 7) % 7
      return aDist - bDist
    })

    result.dojo = {
      sessionsThisWeek,
      weeklyCaloriesBurned,
      upcomingSessions: upcoming,
    }
  }

  // Habits data
  if (journey.kataTargets) {
    const commitmentIds = (journey.kataTargets.commitmentIds ?? []).map((id: any) =>
      id instanceof ObjectId ? id : new ObjectId(id),
    )
    const commitments = await getCommitmentsCollection()
    const selected = commitmentIds.length > 0
      ? await commitments.find({ _id: { $in: commitmentIds }, userId }).toArray()
      : []

    const logCol = await getCommitmentLogsCollection()
    const todayLogs = await logCol
      .aggregate([
        {
          $match: {
            commitmentId: { $in: selected.map((c) => c._id) },
            userId,
            date: { $gte: todayStart, $lte: todayEnd },
          },
        },
        { $group: { _id: "$commitmentId", total: { $sum: "$value" } } },
      ])
      .toArray()

    const todayTotals = new Map(todayLogs.map((r) => [r._id.toString(), r.total]))

    const kataData = selected.map((c) => {
      const current = todayTotals.get(c._id.toString()) ?? 0
      let target = c.targetValue ?? 0

      // For taper commitments, use the current phase's daily limit as the target
      if (c.type === "taper" && c.taperPhases?.length > 0 && c.startDate) {
        const sortedPhases = [...c.taperPhases].sort((a: any, b: any) => a.weekNumber - b.weekNumber)
        const startDate = c.startDate instanceof Date ? c.startDate : new Date(c.startDate)
        const { activePhase } = calculateTaperPhaseInfo(startDate, sortedPhases, c.status ?? "active", now)
        target = activePhase?.dailyLimit ?? sortedPhases[sortedPhases.length - 1].dailyLimit
      }

      const percentage = target > 0 ? Math.round((current / target) * 100) : 0
      return {
        ...serializeCommitment(c),
        progress: { current, target, percentage },
      }
    })

    const dailyCommitments = kataData.filter((c) => c.period === "daily" || c.type === "taper")
    const otherCommitments = kataData.filter((c) => c.period !== "daily" && c.type !== "taper")

    result.kata = { dailyCommitments, otherCommitments }
  }

  // Running progress across the journey
  result.running = await getRunningProgress(userId, journey, userTz, now)

  // Weight log data (all-time history, journey-scoped goal/target)
  const weightLogCol = await getWeightLogCollection()
  const journeyStartStr = journey.startDate instanceof Date
    ? journey.startDate.toISOString()
    : String(journey.startDate)
  const journeyEndStr = journey.endDate instanceof Date
    ? journey.endDate.toISOString()
    : String(journey.endDate)

  const weightEntries = await weightLogCol
    .find({
      userId,
      date: { $lte: today },
    })
    .sort({ date: 1 })
    .toArray()

  result.weight = {
    entries: weightEntries.filter((e) => e.weight != null).map((e) => ({ date: e.date, weight: e.weight })),
    waistEntries: weightEntries.filter((e) => e.waist != null).map((e) => ({ date: e.date, waist: e.waist })),
    journeyStart: journeyStartStr,
    journeyEnd: journeyEndStr,
    weightGoalLbsPerWeek: journey.shokuTargets?.weightGoalLbsPerWeek ?? null,
    targetWeight: journey.shokuTargets?.targetWeight ?? null,
  }

  return result
}

type RunWeek = {
  weekStart: string
  runs: number
  miles: number
  /** Duration and distance of runs that have a usable duration, for pace */
  minutes: number
  pacedMiles: number
  avgPace: number | null
}

/** Minutes per mile across a set of runs, weighted by distance. */
function weightedPace(minutes: number, miles: number): number | null {
  return miles > 0 && minutes > 0 ? minutes / miles : null
}

/**
 * Running progress across the journey: completed "run" logs with a distance,
 * bucketed into Monday-start weeks in the user's timezone.
 */
async function getRunningProgress(
  userId: ObjectId,
  journey: WithId<Document>,
  userTz: string,
  now: Date,
) {
  const journeyStart = journey.startDate instanceof Date ? journey.startDate : new Date(journey.startDate)
  const journeyEnd = journey.endDate instanceof Date ? journey.endDate : new Date(journey.endDate)
  const rangeEnd = journeyEnd < now ? journeyEnd : now

  const logs = await getWorkoutLogsCollection()
  const runs = await logs
    .find({
      userId,
      status: "completed",
      cardioType: "run",
      cardioDistance: { $gt: 0 },
      completedAt: { $gte: journeyStart, $lte: rangeEnd },
    })
    .project({ startedAt: 1, completedAt: 1, cardioDistance: 1 })
    .sort({ completedAt: 1 })
    .toArray()

  const thisWeekStart = startOfWeekTz(now, userTz)
  const lastWeekStart = startOfWeekTz(new Date(thisWeekStart.getTime() - 86400000), userTz)
  const emptyWeekStats = { miles: 0, avgPace: null as number | null }

  if (runs.length === 0) {
    return {
      weeks: [] as RunWeek[],
      summary: { totalRuns: 0, totalMiles: 0, avgPace: null, bestPace: null, longestRun: null },
      thisWeek: emptyWeekStats,
      lastWeek: emptyWeekStats,
    }
  }

  const weeks = new Map<number, RunWeek>()
  let totalMiles = 0
  let totalMinutes = 0
  let totalPacedMiles = 0
  let bestPace: number | null = null
  let longestRun = 0

  for (const r of runs) {
    const miles = r.cardioDistance as number
    const minutes = r.startedAt instanceof Date && r.completedAt instanceof Date
      ? Math.max((r.completedAt.getTime() - r.startedAt.getTime()) / 60000, 0)
      : 0

    const weekStart = startOfWeekTz(r.completedAt, userTz)
    const week = weeks.get(weekStart.getTime()) ?? {
      weekStart: weekStart.toISOString(), runs: 0, miles: 0, minutes: 0, pacedMiles: 0, avgPace: null,
    }
    week.runs++
    week.miles += miles
    totalMiles += miles
    longestRun = Math.max(longestRun, miles)

    // Runs without a usable duration still count toward mileage, but not pace
    if (minutes > 0) {
      week.minutes += minutes
      week.pacedMiles += miles
      totalMinutes += minutes
      totalPacedMiles += miles
      // Ignore sub-mile efforts so a short sprint doesn't set the best pace
      const pace = minutes / miles
      if (miles >= 1 && (bestPace === null || pace < bestPace)) bestPace = pace
    }
    weeks.set(weekStart.getTime(), week)
  }

  // Fill empty weeks from the first run through the current week so gaps show up
  const firstWeek = startOfWeekTz(runs[0].completedAt, userTz)
  const lastWeek = startOfWeekTz(rangeEnd, userTz)
  const filled: RunWeek[] = []
  for (let t = firstWeek.getTime(); t <= lastWeek.getTime(); ) {
    const week = weeks.get(t) ?? { weekStart: new Date(t).toISOString(), runs: 0, miles: 0, minutes: 0, pacedMiles: 0, avgPace: null }
    week.avgPace = weightedPace(week.minutes, week.pacedMiles)
    week.miles = Math.round(week.miles * 100) / 100
    filled.push(week)
    // Step via startOfWeekTz so DST shifts don't drift the boundary
    t = startOfWeekTz(new Date(t + 8 * 86400000), userTz).getTime()
  }

  const weekStats = (start: Date) => {
    const w = weeks.get(start.getTime())
    return w ? { miles: Math.round(w.miles * 100) / 100, avgPace: weightedPace(w.minutes, w.pacedMiles) } : emptyWeekStats
  }

  return {
    weeks: filled.map(({ minutes: _m, pacedMiles: _p, ...w }) => w),
    summary: {
      totalRuns: runs.length,
      totalMiles: Math.round(totalMiles * 100) / 100,
      avgPace: weightedPace(totalMinutes, totalPacedMiles),
      bestPace,
      longestRun,
    },
    thisWeek: weekStats(thisWeekStart),
    lastWeek: weekStats(lastWeekStart),
  }
}
