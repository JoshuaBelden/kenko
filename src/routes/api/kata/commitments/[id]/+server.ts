import {
  getCommitmentsCollection,
  serializeCommitment,
  calculatePeriodProgress,
  VALID_DIRECTIONS,
  VALID_PERIODS,
  VALID_LOGGING_STYLES,
  type Direction,
  type Period,
  type LoggingStyle,
} from "$lib/server/kata"
import { getJourneysCollection } from "$lib/server/collections"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const commitments = await getCommitmentsCollection()
  const commitment = await commitments.findOne({ _id: new ObjectId(params.id), userId })

  if (!commitment) return json({ error: "Not found" }, { status: 404 })

  // Resolve journey start date if journey-scoped
  let journeyStartDate: Date | null = null
  if (commitment.journeyId) {
    const journeys = await getJourneysCollection()
    const journey = await journeys.findOne({ _id: commitment.journeyId, userId })
    journeyStartDate = journey?.startDate ?? null
  }

  const progress = await calculatePeriodProgress(
    commitment._id,
    userId,
    commitment.period,
    commitment.targetValue,
    journeyStartDate,
  )

  return json({ ...serializeCommitment(commitment), progress })
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) {
    if (!body.name?.trim()) return json({ error: "name cannot be empty" }, { status: 400 })
    updates.name = body.name.trim()
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null
  }
  if (body.direction !== undefined) {
    if (!VALID_DIRECTIONS.includes(body.direction as Direction)) {
      return json({ error: "direction must be 'achieve' or 'limit'" }, { status: 400 })
    }
    updates.direction = body.direction
  }
  if (body.period !== undefined) {
    if (!VALID_PERIODS.includes(body.period as Period)) {
      return json({ error: "period must be 'daily', 'weekly', 'monthly', or 'journey_total'" }, { status: 400 })
    }
    updates.period = body.period
  }
  if (body.loggingStyle !== undefined) {
    if (!VALID_LOGGING_STYLES.includes(body.loggingStyle as LoggingStyle)) {
      return json({ error: "loggingStyle must be 'checkbox' or 'quantity'" }, { status: 400 })
    }
    updates.loggingStyle = body.loggingStyle
  }
  if (body.targetValue !== undefined) {
    if (typeof body.targetValue !== "number" || body.targetValue <= 0) {
      return json({ error: "targetValue must be a positive number" }, { status: 400 })
    }
    updates.targetValue = body.targetValue
  }
  if (body.unit !== undefined) {
    updates.unit = body.unit?.trim() || null
  }
  if (body.journeyId !== undefined) {
    updates.journeyId = body.journeyId ? new ObjectId(body.journeyId) : null
  }

  const userId = new ObjectId(locals.userId)
  const commitments = await getCommitmentsCollection()
  const result = await commitments.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeCommitment(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const commitments = await getCommitmentsCollection()
  const result = await commitments.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId },
    { $set: { isActive: false, updatedAt: new Date() } },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
