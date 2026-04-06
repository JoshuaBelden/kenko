import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  calculatePeriodProgress,
  getPeriodHistory,
} from "$lib/server/kata"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const commitmentId = new ObjectId(params.id)

  const commitments = await getCommitmentsCollection()
  const commitment = await commitments.findOne({ _id: commitmentId, userId })
  if (!commitment) return json({ error: "Not found" }, { status: 404 })

  const [progress, history, allTimeResult] = await Promise.all([
    calculatePeriodProgress(commitmentId, userId, commitment.period, commitment.targetValue),
    getPeriodHistory(commitmentId, userId, commitment.period, commitment.targetValue, commitment.direction),
    getCommitmentLogsCollection().then((logs) =>
      logs
        .aggregate([
          { $match: { commitmentId, userId } },
          { $group: { _id: null, total: { $sum: "$value" } } },
        ])
        .toArray(),
    ),
  ])

  const allTimeTotal = allTimeResult.length > 0 ? allTimeResult[0].total : 0

  return json({
    progress,
    history: history.periods,
    journeyTotal: history.journeyTotal,
    allTimeTotal,
  })
}
