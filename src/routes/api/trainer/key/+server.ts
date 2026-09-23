import { TrainerKeyError, removeTrainerApiKey, saveTrainerApiKey } from "$lib/server/trainer"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const PUT: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (typeof body.apiKey !== "string" || !body.apiKey.trim()) {
    return json({ error: "apiKey is required" }, { status: 400 })
  }

  try {
    const { last4 } = await saveTrainerApiKey(new ObjectId(locals.userId), body.apiKey)
    return json({ hasKey: true, last4 })
  } catch (err) {
    if (err instanceof TrainerKeyError) return json({ error: err.message }, { status: 400 })
    throw err
  }
}

export const DELETE: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })
  await removeTrainerApiKey(new ObjectId(locals.userId))
  return json({ hasKey: false, last4: null })
}
