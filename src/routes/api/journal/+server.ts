import { getUsersCollection } from "$lib/server/collections"
import { getJournalEntry, createJournalEntry, updateWeather, serializeJournalEntry } from "$lib/server/journal"
import { fetchWeatherForDate } from "$lib/server/weatherApi"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = url.searchParams.get("journeyId")
  const date = url.searchParams.get("date")

  if (!journeyId) return json({ error: "journeyId is required" }, { status: 400 })
  if (!date) return json({ error: "date is required" }, { status: 400 })

  const entry = await getJournalEntry(
    new ObjectId(locals.userId),
    new ObjectId(journeyId),
    date,
  )

  return json(entry ? serializeJournalEntry(entry) : null)
}

export const PATCH: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { entryId, date } = body

  if (!entryId) return json({ error: "entryId is required" }, { status: 400 })
  if (!date) return json({ error: "date is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)

  try {
    const users = await getUsersCollection()
    const user = await users.findOne(
      { _id: userId },
      { projection: { "profile.latitude": 1, "profile.longitude": 1 } },
    )
    const lat = user?.profile?.latitude
    const lon = user?.profile?.longitude
    if (lat == null || lon == null) {
      return json({ error: "No location set on profile" }, { status: 422 })
    }
    const weather = await fetchWeatherForDate(lat, lon, date, locals.userTimezone ?? "America/Los_Angeles")
    if (!weather) return json({ error: "Weather unavailable" }, { status: 502 })
    await updateWeather(new ObjectId(entryId), userId, weather)
    return json(weather)
  } catch {
    return json({ error: "Failed to fetch weather" }, { status: 502 })
  }
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { journeyId, date } = body

  if (!journeyId) return json({ error: "journeyId is required" }, { status: 400 })
  if (!date) return json({ error: "date is required" }, { status: 400 })

  const userId = new ObjectId(locals.userId)
  const jId = new ObjectId(journeyId)

  // Check if entry already exists for this journey + date
  const existing = await getJournalEntry(userId, jId, date)
  if (existing) {
    return json(serializeJournalEntry(existing))
  }

  const entry = await createJournalEntry(userId, jId, date)

  // Best-effort weather fetch
  try {
    const users = await getUsersCollection()
    const user = await users.findOne(
      { _id: userId },
      { projection: { "profile.latitude": 1, "profile.longitude": 1 } },
    )
    const lat = user?.profile?.latitude
    const lon = user?.profile?.longitude
    if (lat != null && lon != null) {
      const weather = await fetchWeatherForDate(lat, lon, date, locals.userTimezone ?? "America/Los_Angeles")
      if (weather) {
        await updateWeather(entry._id, userId, weather)
        ;(entry as any).weather = weather
      }
    }
  } catch {
    // Weather fetch failed — entry is still valid without it
  }

  return json(serializeJournalEntry(entry), { status: 201 })
}
