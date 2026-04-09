import { getJourneysCollection, getWeightLogCollection } from "$lib/server/collections"
import { getFastsCollection } from "$lib/server/danjiki"
import { startOfDayTz, endOfDayTz, startOfWeekTz, endOfWeekTz, todayStr } from "$lib/server/dates"
import { getWorkoutLogsCollection, getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { getCommitmentsCollection, getCommitmentLogsCollection, serializeCommitment, calculateTaperPhaseInfo } from "$lib/server/kata"
import { getFoodItemLogsCollection, getWaterLogCollection } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  const userTz = locals.userTimezone ?? "America/Los_Angeles"
  const now = new Date()
  const today = todayStr(userTz)
  const todayStart = startOfDayTz(today, userTz)
  const todayEnd = endOfDayTz(today, userTz)
  const weekStart = startOfWeekTz(now, userTz)
  const weekEnd = endOfWeekTz(now, userTz)

  const result: Record<string, unknown> = {}

  // Shoku data
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

    result.shoku = {
      totals,
      waterOz: waterEntry?.ounces ?? 0,
    }
  }

  // Danjiki data
  if (journey.danjikiTargets) {
    const fasts = await getFastsCollection()

    // Weekly completed fasting hours
    const weekFasts = await fasts
      .find({
        userId,
        journeyIds: journeyId,
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

  // Dojo data
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
      weekLogQuery.planId = { $in: planIds }
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

    // Build a set of completed plan+session combos this week
    const completedKeys = new Set(
      weekLogs.map((l) => `${l.planId?.toString()}::${l.planSnapshot?.sessionName}`),
    )

    const todayDow = now.getUTCDay()
    const upcoming: Array<{ planName: string; sessionName: string; targetDay: number | null; completed: boolean }> = []
    for (const plan of selectedPlans) {
      for (const session of plan.sessions ?? []) {
        upcoming.push({
          planName: plan.name,
          sessionName: session.name,
          targetDay: session.targetDayOfWeek ?? null,
          completed: completedKeys.has(`${plan._id.toString()}::${session.name}`),
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

  // Kata data
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

    const dailyCommitments = kataData.filter((c) => c.period === "daily" && c.type !== "taper")
    const otherCommitments = kataData.filter((c) => c.period !== "daily" || c.type === "taper")

    result.kata = { dailyCommitments, otherCommitments }
  }

  // Weight log data (scoped to journey date range)
  const weightLogCol = await getWeightLogCollection()
  const journeyStartStr = journey.startDate instanceof Date
    ? journey.startDate.toISOString()
    : String(journey.startDate)
  const journeyEndStr = journey.endDate instanceof Date
    ? journey.endDate.toISOString()
    : String(journey.endDate)
  const journeyStartDateOnly = journeyStartStr.split("T")[0]

  const weightEntries = await weightLogCol
    .find({
      userId,
      date: { $gte: journeyStartDateOnly, $lte: today },
    })
    .sort({ date: 1 })
    .toArray()

  result.weight = {
    entries: weightEntries.map((e) => ({ date: e.date, weight: e.weight })),
    journeyStart: journeyStartStr,
    journeyEnd: journeyEndStr,
    weightGoalLbsPerWeek: journey.shokuTargets?.weightGoalLbsPerWeek ?? null,
  }

  return json(result)
}
