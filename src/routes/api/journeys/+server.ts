import { getJourneysCollection } from "$lib/server/collections"
import { serializeJourney } from "$lib/server/journeys"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeys = await getJourneysCollection()
  const list = await journeys.find({ userId: new ObjectId(locals.userId) }).sort({ startDate: -1 }).toArray()

  return json(list.map(serializeJourney))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, description, startDate, endDate } = body

  if (!name || !startDate || !endDate) {
    return json({ error: "name, startDate, and endDate are required" }, { status: 400 })
  }

  const now = new Date()
  const journeys = await getJourneysCollection()
  const result = await journeys.insertOne({
    userId: new ObjectId(locals.userId),
    name,
    description: description ?? "",
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: "active",
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  })

  const created = await journeys.findOne({ _id: result.insertedId })
  return json(serializeJourney(created!), { status: 201 })
}
