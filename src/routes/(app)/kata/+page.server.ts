import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  serializeCommitment,
  calculatePeriodProgress,
  getTaperProgress,
} from "$lib/server/kata"
import { todayStr, startOfDayTz, endOfDayTz } from "$lib/server/dates"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) return { commitments: [], date: "" }

  const userId = new ObjectId(locals.userId)
  const tz = locals.userTimezone ?? "America/Los_Angeles"
  const dateStr = url.searchParams.get("date") ?? todayStr(tz)
  const dayStart = startOfDayTz(dateStr, tz)
  const dayEnd = endOfDayTz(dateStr, tz)

  const commitmentsCol = await getCommitmentsCollection()
  const [commitments, inactiveCommitments] = await Promise.all([
    commitmentsCol.find({ userId, isActive: true }).sort({ createdAt: -1 }).toArray(),
    commitmentsCol.find({ userId, isActive: false }).sort({ updatedAt: -1 }).toArray(),
  ])

  // Get logs for the selected date and current progress for each commitment
  const logsCol = await getCommitmentLogsCollection()

  const commitmentIds = commitments.map((c) => c._id)
  const dayLogs = await logsCol
    .find({
      commitmentId: { $in: commitmentIds },
      userId,
      date: { $gte: dayStart, $lte: dayEnd },
    })
    .toArray()

  const dayLogMap = new Map(dayLogs.map((log) => [log.commitmentId.toString(), log]))

  const enriched = await Promise.all(
    commitments.map(async (c) => {
      const todayLog = dayLogMap.get(c._id.toString())

      // Taper commitments get taper progress instead of period progress
      if (c.type === "taper") {
        const taperProgress = await getTaperProgress(
          c._id,
          userId,
          c.startDate,
          c.taperPhases ?? [],
          c.status ?? "active",
          dayStart,
        )
        return {
          ...serializeCommitment(c),
          progress: null,
          taperProgress,
          todayLog: todayLog ? { value: todayLog.value } : null,
        }
      }

      const progress = await calculatePeriodProgress(c._id, userId, c.period, c.targetValue, null, dayStart)

      return {
        ...serializeCommitment(c),
        progress,
        taperProgress: null,
        todayLog: todayLog ? { value: todayLog.value } : null,
      }
    }),
  )

  return {
    commitments: enriched,
    inactiveCommitments: inactiveCommitments.map(serializeCommitment),
    date: dateStr,
  }
}
