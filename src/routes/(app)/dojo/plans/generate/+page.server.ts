import { getTrainerKeyStatus } from "$lib/server/trainer"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { hasApiKey: false }

  const { hasKey } = await getTrainerKeyStatus(new ObjectId(locals.userId))
  return { hasApiKey: hasKey }
}
