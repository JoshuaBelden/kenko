import {
  aggregateRecovery,
  getWorkoutLogsCollection,
  getWorkoutPlansCollection,
  serializeWorkoutLog,
  serializeWorkoutPlan,
} from "$lib/server/dojo"
import { dayOfWeekTz, startOfWeekTz, endOfWeekTz } from "$lib/server/dates"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) {
    return {
      plans: [],
      inProgressLogs: [],
      recovery: [],
      stats: { thisWeekCount: 0, totalSessions: 0 },
    }
  }

  const userId = new ObjectId(locals.userId)
  const userTz = locals.userTimezone ?? "America/Los_Angeles"

  const [plansCol, logsCol] = await Promise.all([
    getWorkoutPlansCollection(),
    getWorkoutLogsCollection(),
  ])

  const weekStart = startOfWeekTz(new Date(), userTz)
  const weekEnd = endOfWeekTz(new Date(), userTz)

  const [plans, inProgressLogs, totalSessions, thisWeekCount, recovery] = await Promise.all([
    plansCol.find({ userId }).sort({ createdAt: -1 }).toArray(),
    logsCol.find({ userId, status: "in_progress" }).sort({ startedAt: -1 }).toArray(),
    logsCol.countDocuments({ userId, status: "completed" }),
    logsCol.countDocuments({ userId, status: "completed", completedAt: { $gte: weekStart, $lte: weekEnd } }),
    aggregateRecovery(userId),
  ])

  const todayDow = dayOfWeekTz(new Date(), userTz)
  function dayRank(d: number | null): number {
    return d === null ? 7 : (d - todayDow + 7) % 7
  }

  const quickStart = plans
    .map(serializeWorkoutPlan)
    .map((p) => {
      const sessions = [...p.sessions].sort(
        (a, b) => dayRank(a.targetDayOfWeek) - dayRank(b.targetDayOfWeek),
      )
      const rank = sessions.length > 0 ? dayRank(sessions[0].targetDayOfWeek) : 7
      return { ...p, sessions, _rank: rank }
    })
    .sort((a, b) => a._rank - b._rank)
    .map(({ _rank, ...p }) => p)

  return {
    plans: quickStart,
    inProgressLogs: inProgressLogs.map(serializeWorkoutLog),
    recovery,
    stats: { thisWeekCount, totalSessions },
  }
}
