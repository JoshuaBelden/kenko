import { getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) return { plans: [] }

  const userId = new ObjectId(locals.userId)
  const plansCol = await getWorkoutPlansCollection()
  const plans = await plansCol.find({ userId }).sort({ createdAt: -1 }).toArray()

  return {
    plans: plans.map(serializeWorkoutPlan),
  }
}
