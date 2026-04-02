import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  serializeCommitment,
  calculatePeriodProgress,
  getPeriodHistory,
} from "$lib/server/kata"
import { getJourneysCollection } from "$lib/server/collections"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.userId) return { commitment: null, progress: null, history: null, journeyTotal: null, allTimeTotal: 0 }

  const userId = new ObjectId(locals.userId)
  const commitmentId = new ObjectId(params.id)

  const commitmentsCol = await getCommitmentsCollection()
  const commitment = await commitmentsCol.findOne({ _id: commitmentId, userId })
  if (!commitment) return { commitment: null, progress: null, history: null, journeyTotal: null, allTimeTotal: 0 }

  // Resolve journey start date if journey-scoped
  let journeyStartDate: Date | null = null
  let journeyName: string | null = null
  if (commitment.journeyId) {
    const journeys = await getJourneysCollection()
    const journey = await journeys.findOne({ _id: commitment.journeyId, userId })
    journeyStartDate = journey?.startDate ?? null
    journeyName = journey?.name ?? null
  }

  const logsCol = await getCommitmentLogsCollection()
  const [progress, historyResult, allTimeResult] = await Promise.all([
    calculatePeriodProgress(commitmentId, userId, commitment.period, commitment.targetValue, journeyStartDate),
    getPeriodHistory(commitmentId, userId, commitment.period, commitment.targetValue, commitment.direction, journeyStartDate),
    logsCol
      .aggregate([
        { $match: { commitmentId, userId } },
        { $group: { _id: null, total: { $sum: "$value" } } },
      ])
      .toArray(),
  ])

  const allTimeTotal = allTimeResult.length > 0 ? allTimeResult[0].total : 0

  return {
    commitment: { ...serializeCommitment(commitment), journeyName },
    progress,
    history: historyResult.periods,
    journeyTotal: historyResult.journeyTotal,
    allTimeTotal,
  }
}
