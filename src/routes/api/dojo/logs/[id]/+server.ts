import { getWorkoutLogsCollection, serializeWorkoutLog } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const logs = await getWorkoutLogsCollection()
  const log = await logs.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!log) return json({ error: "Not found" }, { status: 404 })
  return json(serializeWorkoutLog(log))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const logs = await getWorkoutLogsCollection()
  const result = await logs.deleteOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (result.deletedCount === 0) return json({ error: "Not found" }, { status: 404 })
  return new Response(null, { status: 204 })
}
