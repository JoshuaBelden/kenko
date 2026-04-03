import { getUsersCollection } from "$lib/server/collections"
import { calculateTdee } from "$lib/server/tdee"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const users = await getUsersCollection()
  const user = await users.findOne({ _id: new ObjectId(locals.userId) })
  if (!user?.profile) return json({ error: "Profile not found" }, { status: 404 })

  const { weight, height, sex, birthDate, activityLevel, tdeeOverride } = user.profile

  if (!weight || !height || !sex || !birthDate || !activityLevel) {
    return json({
      calculated: null,
      effective: tdeeOverride ?? null,
      override: tdeeOverride ?? null,
      missing: ["weight", "height", "sex", "birthDate", "activityLevel"].filter(
        (f) => !user.profile[f],
      ),
    })
  }

  const result = calculateTdee({
    weightLbs: weight,
    heightIn: height,
    sex,
    birthDate,
    activityLevel,
  })

  return json({
    calculated: result.tdee,
    effective: tdeeOverride ?? result.tdee,
    override: tdeeOverride ?? null,
    bmr: result.bmr,
    multiplier: result.multiplier,
  })
}
