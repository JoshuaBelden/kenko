import { getJourneysCollection } from "$lib/server/collections"
import { getFastsCollection } from "$lib/server/danjiki"
import { getWorkoutLogsCollection, getWorkoutPlansCollection } from "$lib/server/dojo"
import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  calculatePeriodProgress,
  serializeCommitment,
} from "$lib/server/kata"
import { getDiaryEntriesCollection, getWaterLogCollection } from "$lib/server/shoku"
import { serializeJourney } from "$lib/server/journeys"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

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

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { dashboardJourneys: [], snapshots: {} }

  const userId = new ObjectId(locals.userId)
  const now = new Date()
  const today = now.toISOString().split("T")[0]
  const weekStart = startOfWeek(now)
  const weekEnd = endOfDay(now)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  // Load active journeys with full target data
  const journeysCol = await getJourneysCollection()
  const activeJourneys = await journeysCol
    .find({
      userId,
      status: "active",
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
    })
    .sort({ startDate: -1 })
    .toArray()

  const serialized = activeJourneys.map(serializeJourney)

  // Build snapshot data for each journey that has targets
  const snapshots: Record<string, any> = {}

  for (const journey of activeJourneys) {
    const jid = journey._id
    const snap: Record<string, any> = {}
    let hasData = false

    // Shoku
    if (journey.shokuTargets) {
      hasData = true
      const diary = await getDiaryEntriesCollection()
      const todayEntries = await diary
        .find({ userId, journeyIds: jid, date: { $gte: todayStart, $lte: todayEnd } })
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

      snap.shoku = { totals, waterOz: waterEntry?.ounces ?? 0, targets: journey.shokuTargets }
    }

    // Danjiki — show if targets configured OR if a fast is running
    const fasts = await getFastsCollection()
    const activeFast = await fasts.findOne({ userId, status: "running" })

    if (journey.danjikiTargets || activeFast) {
      hasData = true
      const weekFasts = await fasts
        .find({
          userId,
          journeyIds: jid,
          status: "completed",
          endedAt: { $gte: weekStart, $lte: weekEnd },
        })
        .toArray()

      const weeklyHours = weekFasts.reduce((sum, f) => sum + (f.actualDuration ?? 0), 0)

      snap.danjiki = {
        weeklyHoursFasted: Math.round(weeklyHours * 10) / 10,
        weeklyTarget: journey.danjikiTargets?.weeklyFastingHours ?? null,
        activeFast: activeFast
          ? {
              startedAt:
                activeFast.startedAt instanceof Date
                  ? activeFast.startedAt.toISOString()
                  : activeFast.startedAt,
              targetDuration: activeFast.targetDuration,
            }
          : null,
      }
    }

    // Dojo
    if (journey.dojoTargets) {
      hasData = true
      const logs = await getWorkoutLogsCollection()
      const weekLogs = await logs
        .find({
          userId,
          journeyIds: jid,
          status: "completed",
          completedAt: { $gte: weekStart, $lte: weekEnd },
        })
        .toArray()

      // Today's scheduled session
      const planIds = (journey.dojoTargets.planIds ?? []).map((id: any) =>
        id instanceof ObjectId ? id : new ObjectId(id),
      )
      const plans = await getWorkoutPlansCollection()
      const selectedPlans =
        planIds.length > 0 ? await plans.find({ _id: { $in: planIds }, userId }).toArray() : []

      const todayDow = now.getUTCDay()
      const todaySessions: Array<{ planName: string; sessionName: string }> = []
      for (const plan of selectedPlans) {
        for (const session of plan.sessions ?? []) {
          if (session.targetDayOfWeek === todayDow) {
            todaySessions.push({ planName: plan.name, sessionName: session.name })
          }
        }
      }

      snap.dojo = {
        sessionsThisWeek: weekLogs.length,
        sessionsPerWeek: journey.dojoTargets.sessionsPerWeek ?? null,
        weeklyCalorieBurn: journey.dojoTargets.weeklyCalorieBurn ?? null,
        todaySessions,
      }
    }

    // Kata
    if (journey.kataTargets) {
      const commitmentIds = (journey.kataTargets.commitmentIds ?? []).map((id: any) =>
        id instanceof ObjectId ? id : new ObjectId(id),
      )
      if (commitmentIds.length > 0) {
        hasData = true
        const commitments = await getCommitmentsCollection()
        const selected = await commitments.find({ _id: { $in: commitmentIds }, userId }).toArray()

        const commitmentLogs = await getCommitmentLogsCollection()

        const kataData = await Promise.all(
          selected.map(async (c) => {
            const progress = await calculatePeriodProgress(
              c._id,
              userId,
              c.period,
              c.targetValue,
              journey.startDate,
            )
            const todayLog = await commitmentLogs.findOne({
              commitmentId: c._id,
              userId,
              date: { $gte: todayStart, $lte: todayEnd },
            })
            return {
              ...serializeCommitment(c),
              progress,
              loggedToday: todayLog != null,
            }
          }),
        )

        snap.kata = { commitments: kataData }
      }
    }

    if (hasData) {
      snapshots[jid.toString()] = snap
    }
  }

  return { dashboardJourneys: serialized, snapshots }
}
