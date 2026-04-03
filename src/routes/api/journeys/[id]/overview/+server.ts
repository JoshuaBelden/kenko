import { getJourneysCollection } from "$lib/server/collections"
import { getFastsCollection } from "$lib/server/danjiki"
import { getWorkoutLogsCollection, getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { getCommitmentsCollection, calculatePeriodProgress, serializeCommitment } from "$lib/server/kata"
import { getDiaryEntriesCollection, getWaterLogCollection } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - diff)
  return d
}

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const weekStart = startOfWeek(now)
  const weekEnd = endOfDay(now)

  const result: Record<string, unknown> = {}

  // Shoku data
  if (journey.shokuTargets) {
    const diary = await getDiaryEntriesCollection()
    const todayEntries = await diary
      .find({
        userId,
        date: { $gte: startOfDay(now), $lte: endOfDay(now) },
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

    const weekLogs = await logs
      .find({
        userId,
        journeyIds: journeyId,
        status: "completed",
        completedAt: { $gte: weekStart, $lte: weekEnd },
      })
      .toArray()

    const sessionsThisWeek = weekLogs.length

    // Get upcoming sessions from selected plans
    const planIds = (journey.dojoTargets.planIds ?? []).map((id: any) =>
      id instanceof ObjectId ? id : new ObjectId(id),
    )
    const plans = await getWorkoutPlansCollection()
    const selectedPlans = planIds.length > 0
      ? await plans.find({ _id: { $in: planIds }, userId }).toArray()
      : []

    const todayDow = now.getUTCDay()
    const upcoming: Array<{ planName: string; sessionName: string; targetDay: number | null }> = []
    for (const plan of selectedPlans) {
      for (const session of plan.sessions ?? []) {
        upcoming.push({
          planName: plan.name,
          sessionName: session.name,
          targetDay: session.targetDayOfWeek ?? null,
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
      weeklyCaloriesBurned: 0, // placeholder — no calorie tracking on workout logs yet
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

    const kataData = await Promise.all(
      selected.map(async (c) => {
        const progress = await calculatePeriodProgress(
          c._id,
          userId,
          c.period,
          c.targetValue,
          journey.startDate,
        )
        return {
          ...serializeCommitment(c),
          progress,
        }
      }),
    )

    result.kata = { commitments: kataData }
  }

  return json(result)
}
