import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  serializeCommitment,
  calculatePeriodProgress,
} from "$lib/server/kata"
import { getJourneysCollection } from "$lib/server/collections"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.userId) return { commitments: [] }

  const userId = new ObjectId(locals.userId)
  const journeyId = url.searchParams.get("journeyId")

  const commitmentsCol = await getCommitmentsCollection()
  const filter: Record<string, unknown> = { userId, isActive: true }

  if (journeyId) {
    filter.$or = [{ journeyId: new ObjectId(journeyId) }, { journeyId: null }]
  }

  const commitments = await commitmentsCol.find(filter).sort({ createdAt: -1 }).toArray()

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

  // Resolve journey start dates for journey_total commitments
  const journeyIds = [...new Set(commitments.filter((c) => c.journeyId).map((c) => c.journeyId.toString()))]
  const journeyStartDates = new Map<string, Date>()
  if (journeyIds.length > 0) {
    const journeysCol = await getJourneysCollection()
    const journeys = await journeysCol
      .find({ _id: { $in: journeyIds.map((id) => new ObjectId(id)) } })
      .toArray()
    for (const j of journeys) {
      journeyStartDates.set(j._id.toString(), j.startDate)
    }
  }

  const enriched = await Promise.all(
    commitments.map(async (c) => {
      const journeyStartDate = c.journeyId ? journeyStartDates.get(c.journeyId.toString()) ?? null : null
      const progress = await calculatePeriodProgress(c._id, userId, c.period, c.targetValue, journeyStartDate)
      const todayLog = todayLogMap.get(c._id.toString())

      return {
        ...serializeCommitment(c),
        progress,
        todayLog: todayLog ? { value: todayLog.value } : null,
      }
    }),
  )

  return { commitments: enriched }
}
