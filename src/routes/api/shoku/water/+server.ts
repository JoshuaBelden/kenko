import { getWaterLogCollection } from "$lib/server/shoku"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const dateStr = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0]

  const waterLog = await getWaterLogCollection()
  const doc = await waterLog.findOne({
    userId: new ObjectId(locals.userId),
    date: dateStr,
  })

  return json({ ounces: doc?.ounces ?? 0 })
}

export const PUT: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const ounces = typeof body.ounces === "number" ? body.ounces : 0
  const dateStr = typeof body.date === "string" ? body.date : new Date().toISOString().split("T")[0]

  if (ounces < 0) return json({ error: "Ounces must be non-negative" }, { status: 400 })

  const waterLog = await getWaterLogCollection()
  const now = new Date()

  await waterLog.updateOne(
    { userId: new ObjectId(locals.userId), date: dateStr },
    {
      $set: { ounces, updatedAt: now },
      $setOnInsert: { userId: new ObjectId(locals.userId), date: dateStr, createdAt: now },
    },
    { upsert: true },
  )

  return json({ ounces })
}
