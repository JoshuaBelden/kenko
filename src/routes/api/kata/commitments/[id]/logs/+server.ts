import {
  getCommitmentsCollection,
  getCommitmentLogsCollection,
  serializeCommitmentLog,
} from "$lib/server/kata"
import { startOfDayTz, endOfDayTz, todayStr } from "$lib/server/dates"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const commitmentId = new ObjectId(params.id)

  // Verify commitment belongs to user
  const commitments = await getCommitmentsCollection()
  const commitment = await commitments.findOne({ _id: commitmentId, userId })
  if (!commitment) return json({ error: "Not found" }, { status: 404 })

  const logs = await getCommitmentLogsCollection()
  const list = await logs
    .find({ commitmentId, userId })
    .sort({ date: -1 })
    .toArray()

  return json(list.map(serializeCommitmentLog))
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const commitmentId = new ObjectId(params.id)

  // Verify commitment belongs to user
  const commitments = await getCommitmentsCollection()
  const commitment = await commitments.findOne({ _id: commitmentId, userId })
  if (!commitment) return json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const value = body.value
  if (typeof value !== "number" || value < 0) {
    return json({ error: "value must be a non-negative number" }, { status: 400 })
  }

  const tz = locals.userTimezone ?? "America/Los_Angeles"
  const dateStr = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : todayStr(tz)
  const dayStart = startOfDayTz(dateStr, tz)
  const dayEnd = endOfDayTz(dateStr, tz)
  const now = new Date()

  const logs = await getCommitmentLogsCollection()

  // Upsert: one log per commitment per day
  const result = await logs.findOneAndUpdate(
    {
      commitmentId,
      userId,
      date: { $gte: dayStart, $lte: dayEnd },
    },
    {
      $set: {
        value,
        updatedAt: now,
      },
      $setOnInsert: {
        commitmentId,
        userId,
        date: dayStart,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  )

  return json(serializeCommitmentLog(result!), { status: result!.createdAt?.getTime() === now.getTime() ? 201 : 200 })
}
