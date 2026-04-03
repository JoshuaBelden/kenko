import {
  getCommitmentsCollection,
  getTaperProgress,
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

  if (commitment.type !== "taper") {
    return json({ error: "Not a taper commitment" }, { status: 400 })
  }

  const taperProgress = await getTaperProgress(
    commitmentId,
    userId,
    commitment.startDate,
    commitment.taperPhases ?? [],
    commitment.status ?? "active",
  )

  return json(taperProgress)
}
