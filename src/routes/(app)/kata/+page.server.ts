import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  serializeCommitment,
  calculatePeriodProgress,
  getTaperProgress,
} from "$lib/server/kata"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { commitments: [] }

  const userId = new ObjectId(locals.userId)

  const commitmentsCol = await getCommitmentsCollection()
  const commitments = await commitmentsCol.find({ userId, isActive: true }).sort({ createdAt: -1 }).toArray()

  // Get today's logs and current progress for each commitment
  const logsCol = await getCommitmentLogsCollection()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setUTCHours(23, 59, 59, 999)

  const commitmentIds = commitments.map((c) => c._id)
  const todayLogs = await logsCol
    .find({
      commitmentId: { $in: commitmentIds },
      userId,
      date: { $gte: todayStart, $lte: todayEnd },
    })
    .toArray()

  const todayLogMap = new Map(todayLogs.map((log) => [log.commitmentId.toString(), log]))

  const enriched = await Promise.all(
    commitments.map(async (c) => {
      const todayLog = todayLogMap.get(c._id.toString())

      // Taper commitments get taper progress instead of period progress
      if (c.type === "taper") {
        const taperProgress = await getTaperProgress(
          c._id,
          userId,
          c.startDate,
          c.taperPhases ?? [],
          c.status ?? "active",
        )
        return {
          ...serializeCommitment(c),
          progress: null,
          taperProgress,
          todayLog: todayLog ? { value: todayLog.value } : null,
        }
      }

      const progress = await calculatePeriodProgress(c._id, userId, c.period, c.targetValue)

      return {
        ...serializeCommitment(c),
        progress,
        taperProgress: null,
        todayLog: todayLog ? { value: todayLog.value } : null,
      }
    }),
  )

  return { commitments: enriched }
}
