import { getJourneysCollection } from "$lib/server/collections"
import { getCalendarDays } from "$lib/server/calendar"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)
  const userTz = locals.userTimezone ?? "America/Los_Angeles"

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  // Parse month param (YYYY-MM)
  const monthParam = url.searchParams.get("month")
  const now = new Date()
  let year: number, month: number
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    ;[year, month] = monthParam.split("-").map(Number)
  } else {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: userTz, year: "numeric", month: "2-digit" })
    const parts = fmt.format(now).split("-")
    year = Number(parts[0])
    month = Number(parts[1])
  }

  // Build date range for the month
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`

  const { days, tdee } = await getCalendarDays(userId, journey, userTz, firstDay, lastDay)
  return json({ year, month, days, tdee })
}
