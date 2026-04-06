import {
  getWorkoutLogsCollection,
  serializeWorkoutLog,
  startWorkoutLog,
} from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const filter: Record<string, unknown> = { userId: new ObjectId(locals.userId) }

  const status = url.searchParams.get("status")
  if (status === "in_progress" || status === "completed") {
    filter.status = status
  }

  const logs = await getWorkoutLogsCollection()
  const list = await logs.find(filter).sort({ startedAt: -1 }).toArray()

  return json(list.map(serializeWorkoutLog))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.planId) return json({ error: "planId is required" }, { status: 400 })
  if (!body.sessionId) return json({ error: "sessionId is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const planId = new ObjectId(body.planId)

  const created = await startWorkoutLog(userId, planId, body.sessionId)
  if (!created) return json({ error: "Plan or session not found" }, { status: 404 })

  return json(serializeWorkoutLog(created), { status: 201 })
}
