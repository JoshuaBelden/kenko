import { getJourneysCollection } from "$lib/server/collections"
import { getWorkoutPlansCollection, serializeWorkoutPlan } from "$lib/server/dojo"
import { getCommitmentsCollection, serializeCommitment } from "$lib/server/kata"
import { serializeJourney } from "$lib/server/journeys"
import { getUsersCollection } from "$lib/server/collections"
import { calculateTdee, type ActivityLevel } from "$lib/server/tdee"
import { error } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!locals.userId) return error(401, "Unauthorized")

  const userId = new ObjectId(locals.userId)
  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: new ObjectId(params.id), userId })

  if (!journey) return error(404, "Journey not found")

  // Load user's workout plans and commitments for settings selectors
  const plans = await getWorkoutPlansCollection()
  const allPlans = await plans.find({ userId }).sort({ name: 1 }).toArray()

  const commitments = await getCommitmentsCollection()
  const allCommitments = await commitments.find({ userId, isActive: true }).sort({ name: 1 }).toArray()

  // Load TDEE from user profile
  const users = await getUsersCollection()
  const user = await users.findOne({ _id: userId })
  let tdee: number | null = null
  if (user?.profile) {
    const { weight, height, sex, birthDate, activityLevel, tdeeOverride } = user.profile
    if (tdeeOverride) {
      tdee = tdeeOverride
    } else if (weight && height && sex && birthDate && activityLevel) {
      const result = calculateTdee({
        weightLbs: weight,
        heightIn: height,
        sex,
        birthDate,
        activityLevel,
      })
      tdee = result.tdee
    }
  }

  return {
    journey: serializeJourney(journey),
    allPlans: allPlans.map(serializeWorkoutPlan),
    allCommitments: allCommitments.map(serializeCommitment),
    tdee,
  }
}
