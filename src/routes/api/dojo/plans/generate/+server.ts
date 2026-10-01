import { PlanGeneratorError, generatePlanDraft, parseDraftMessages } from "$lib/server/planGenerator"
import { getTrainerApiKey, trainerErrorResponse } from "$lib/server/trainer"
import { PLAN_GENERATOR_MAX_MESSAGE_LENGTH, PLAN_GENERATOR_MAX_USER_TURNS } from "$lib/planDraft"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

// Opus with structured output can take a while on a multi-session plan
export const config = { maxDuration: 300 }

/**
 * Generates or revises a plan draft. The conversation lives on the client: the latest assistant
 * turn is the current (possibly hand-edited) draft as JSON, followed by the user's request.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const body = await request.json().catch(() => ({}))

  let messages
  try {
    messages = parseDraftMessages(body.messages, PLAN_GENERATOR_MAX_USER_TURNS, PLAN_GENERATOR_MAX_MESSAGE_LENGTH)
  } catch (err) {
    if (err instanceof PlanGeneratorError) return json({ error: err.message }, { status: 400 })
    throw err
  }

  const apiKey = await getTrainerApiKey(userId)
  if (!apiKey) {
    return json({ error: "Add your Anthropic API key in Journey Settings → Trainer to generate plans." }, { status: 403 })
  }

  try {
    const draft = await generatePlanDraft(userId, apiKey, messages)
    return json({ draft })
  } catch (err) {
    if (err instanceof PlanGeneratorError) return json({ error: err.message }, { status: 502 })
    return trainerErrorResponse(err, "plan-generator")
  }
}
