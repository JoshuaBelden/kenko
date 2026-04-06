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

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const commitments = await getCommitmentsCollection()
  const list = await commitments.find({ userId, isActive: true }).sort({ createdAt: -1 }).toArray()

  return json(list.map(serializeCommitment))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.name?.trim()) return json({ error: "name is required" }, { status: 400 })

  const isTaper = body.type === "taper"

  if (isTaper) {
    // Taper-specific validation
    if (!body.unit?.trim()) {
      return json({ error: "unit is required for taper commitments" }, { status: 400 })
    }
    if (!body.startDate) {
      return json({ error: "startDate is required for taper commitments" }, { status: 400 })
    }
    if (!Array.isArray(body.taperPhases) || body.taperPhases.length === 0) {
      return json({ error: "at least one taper phase is required" }, { status: 400 })
    }
    for (const phase of body.taperPhases) {
      if (typeof phase.weekNumber !== "number" || phase.weekNumber < 1) {
        return json({ error: "each phase must have a valid weekNumber (>= 1)" }, { status: 400 })
      }
      if (typeof phase.dailyLimit !== "number" || phase.dailyLimit < 0) {
        return json({ error: "each phase must have a valid dailyLimit (>= 0)" }, { status: 400 })
      }
    }

    const now = new Date()
    const startDate = new Date(body.startDate)
    const taperPhases = body.taperPhases.map((p: { weekNumber: number; label?: string; dailyLimit: number }) => ({
      _id: new ObjectId(),
      weekNumber: p.weekNumber,
      label: p.label?.trim() || `Week ${p.weekNumber}`,
      dailyLimit: p.dailyLimit,
    }))

    // Determine initial status based on startDate
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)
    const status = startDate > todayStart ? "scheduled" : "active"

    const commitments = await getCommitmentsCollection()
    const result = await commitments.insertOne({
      userId: new ObjectId(locals.userId),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      type: "taper",
      unit: body.unit.trim(),
      startDate,
      status,
      isActive: true,
      taperPhases,
      direction: null,
      period: null,
      loggingStyle: null,
      targetValue: null,
      createdAt: now,
      updatedAt: now,
    })

    const created = await commitments.findOne({ _id: result.insertedId })
    return json(serializeCommitment(created!), { status: 201 })
  }

  // Non-taper validation (existing logic)
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
    name: body.name.trim(),
    description: body.description?.trim() || null,
    type: body.type || null,
    direction: body.direction,
    period: body.period,
    loggingStyle: body.loggingStyle,
    targetValue: body.targetValue,
    unit: body.unit?.trim() || null,
    startDate: null,
    status: null,
    taperPhases: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  const created = await commitments.findOne({ _id: result.insertedId })
  return json(serializeCommitment(created!), { status: 201 })
}
