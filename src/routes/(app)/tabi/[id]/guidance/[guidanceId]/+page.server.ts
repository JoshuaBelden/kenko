import { getJourneysCollection, getTrainerGuidanceCollection } from "$lib/server/collections"
import { todayStr } from "$lib/server/dates"
import { serializeGuidance } from "$lib/server/guidance"
import { getTrainerKeyStatus } from "$lib/server/trainer"
import { error } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.userId) return error(401, "Unauthorized")
  if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.guidanceId)) return error(404, "Guidance not found")

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)
  const [journey, guidance, keyStatus] = await Promise.all([
    getJourneysCollection().then((col) => col.findOne({ _id: journeyId, userId }, { projection: { name: 1 } })),
    getTrainerGuidanceCollection().then((col) =>
      col.findOne({ _id: new ObjectId(params.guidanceId), journeyId, userId }, { projection: { contextSnapshot: 0, systemPrompt: 0, kickoffPrompt: 0 } }),
    ),
    getTrainerKeyStatus(userId),
  ])
  if (!journey || !guidance) return error(404, "Guidance not found")

  return {
    journey: { id: journey._id.toString(), name: journey.name },
    guidance: serializeGuidance(guidance),
    hasApiKey: keyStatus.hasKey,
    canAsk: guidance.date === todayStr(locals.userTimezone ?? "America/Los_Angeles"),
  }
}
