import { getFastsCollection, serializeFast } from "$lib/server/danjiki"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const fasts = await getFastsCollection()
  const fast = await fasts.findOne({ _id: new ObjectId(params.id), userId })

  if (!fast) return json({ error: "Not found" }, { status: 404 })
  if (fast.status !== "running") {
    return json({ error: "Only running fasts can be ended" }, { status: 400 })
  }

  const now = new Date()
  const elapsed = (now.getTime() - new Date(fast.startedAt).getTime()) / (1000 * 60 * 60)
  const actualDuration = Math.round(elapsed * 100) / 100 // round to 2 decimal places

  const result = await fasts.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId },
    {
      $set: {
        endedAt: now,
        actualDuration,
        status: "completed",
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeFast(result))
}
