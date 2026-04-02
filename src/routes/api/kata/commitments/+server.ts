import {
  getCommitmentsCollection,
  serializeCommitment,
  VALID_DIRECTIONS,
  VALID_PERIODS,
  VALID_LOGGING_STYLES,
  type Direction,
  type Period,
  type LoggingStyle,
} from "$lib/server/kata"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const filter: Record<string, unknown> = { userId, isActive: true }

  const journeyId = url.searchParams.get("journeyId")
  if (journeyId) {
    // Show commitments for this journey + evergreen (null journeyId)
    filter.$or = [{ journeyId: new ObjectId(journeyId) }, { journeyId: null }]
    delete filter.journeyId
  }

  const commitments = await getCommitmentsCollection()
  const list = await commitments.find(filter).sort({ createdAt: -1 }).toArray()

  return json(list.map(serializeCommitment))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.name?.trim()) return json({ error: "name is required" }, { status: 400 })
  if (!body.direction || !VALID_DIRECTIONS.includes(body.direction as Direction)) {
    return json({ error: "direction must be 'achieve' or 'limit'" }, { status: 400 })
  }
  if (!body.period || !VALID_PERIODS.includes(body.period as Period)) {
    return json({ error: "period must be 'daily', 'weekly', 'monthly', or 'journey_total'" }, { status: 400 })
  }
  if (!body.loggingStyle || !VALID_LOGGING_STYLES.includes(body.loggingStyle as LoggingStyle)) {
    return json({ error: "loggingStyle must be 'checkbox' or 'quantity'" }, { status: 400 })
  }
  if (typeof body.targetValue !== "number" || body.targetValue <= 0) {
    return json({ error: "targetValue must be a positive number" }, { status: 400 })
  }

  const now = new Date()
  const commitments = await getCommitmentsCollection()
  const result = await commitments.insertOne({
    userId: new ObjectId(locals.userId),
    journeyId: body.journeyId ? new ObjectId(body.journeyId) : null,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    direction: body.direction,
    period: body.period,
    loggingStyle: body.loggingStyle,
    targetValue: body.targetValue,
    unit: body.unit?.trim() || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  const created = await commitments.findOne({ _id: result.insertedId })
  return json(serializeCommitment(created!), { status: 201 })
}
