import {
  getCommitmentsCollection,
  serializeCommitment,
  calculatePeriodProgress,
  getTaperProgress,
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

  // Taper commitments return taper progress instead of period progress
  if (commitment.type === "taper") {
    const taperProgress = await getTaperProgress(
      commitment._id,
      userId,
      commitment.startDate,
      commitment.taperPhases ?? [],
      commitment.status ?? "active",
    )
    return json({ ...serializeCommitment(commitment), progress: null, taperProgress })
  }

  const progress = await calculatePeriodProgress(
    commitment._id,
    userId,
    commitment.period,
    commitment.targetValue,
  )

  return json({ ...serializeCommitment(commitment), progress, taperProgress: null })
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const userId = new ObjectId(locals.userId)
  const commitments = await getCommitmentsCollection()

  // Load existing commitment to check type
  const existing = await commitments.findOne({ _id: new ObjectId(params.id), userId })
  if (!existing) return json({ error: "Not found" }, { status: 404 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) {
    if (!body.name?.trim()) return json({ error: "name cannot be empty" }, { status: 400 })
    updates.name = body.name.trim()
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null
  }
  if (body.unit !== undefined) {
    updates.unit = body.unit?.trim() || null
  }
  // Taper-specific fields
  if (existing.type === "taper" || body.type === "taper") {
    if (body.startDate !== undefined) {
      updates.startDate = new Date(body.startDate)
    }
    if (body.status !== undefined) {
      if (!["scheduled", "active", "completed"].includes(body.status)) {
        return json({ error: "status must be 'scheduled', 'active', or 'completed'" }, { status: 400 })
      }
      updates.status = body.status
    }
    if (body.taperPhases !== undefined) {
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
      updates.taperPhases = body.taperPhases.map((p: { id?: string; weekNumber: number; label?: string; dailyLimit: number }) => ({
        _id: p.id ? new ObjectId(p.id) : new ObjectId(),
        weekNumber: p.weekNumber,
        label: p.label?.trim() || `Week ${p.weekNumber}`,
        dailyLimit: p.dailyLimit,
      }))
    }
  }

  // Non-taper fields
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
  const commitmentId = new ObjectId(params.id)
  const commitments = await getCommitmentsCollection()
  const result = await commitments.findOneAndUpdate(
    { _id: commitmentId, userId },
    { $set: { isActive: false, updatedAt: new Date() } },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })

  // Remove this commitment from any journey's kataTargets.commitmentIds
  const journeys = await getJourneysCollection()
  await journeys.updateMany(
    { userId, "kataTargets.commitmentIds": commitmentId },
    { $pull: { "kataTargets.commitmentIds": commitmentId } as any },
  )

  return new Response(null, { status: 204 })
}
