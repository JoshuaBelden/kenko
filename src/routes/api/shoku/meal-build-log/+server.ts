import { getMealBuildLogCollection } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const dateStr = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0]

  const mealBuildLog = await getMealBuildLogCollection()
  const doc = await mealBuildLog.findOne({
    userId: new ObjectId(locals.userId),
    date: dateStr,
  })

  return json({
    mealBuildId: doc?.mealBuildId?.toString() ?? null,
    journeyId: doc?.journeyId?.toString() ?? null,
  })
}

export const PUT: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const dateStr = typeof body.date === "string" ? body.date : new Date().toISOString().split("T")[0]
  const mealBuildId = body.mealBuildId ? new ObjectId(body.mealBuildId) : null
  const journeyId = body.journeyId ? new ObjectId(body.journeyId) : null

  const mealBuildLog = await getMealBuildLogCollection()
  const now = new Date()

  if (!mealBuildId) {
    // Clear the selection
    await mealBuildLog.deleteOne({ userId: new ObjectId(locals.userId), date: dateStr })
    return json({ mealBuildId: null, journeyId: null })
  }

  await mealBuildLog.updateOne(
    { userId: new ObjectId(locals.userId), date: dateStr },
    {
      $set: { mealBuildId, journeyId, updatedAt: now },
      $setOnInsert: { userId: new ObjectId(locals.userId), date: dateStr, createdAt: now },
    },
    { upsert: true },
  )

  return json({
    mealBuildId: mealBuildId.toString(),
    journeyId: journeyId?.toString() ?? null,
  })
}
