import { getJourneysCollection } from "$lib/server/collections"
import { getCalendarDays } from "$lib/server/calendar"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

const MAX_RANGE_DAYS = 62

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const userId = new ObjectId(locals.userId)
  const journeyId = new ObjectId(params.id)
  const userTz = locals.userTimezone ?? "America/Los_Angeles"

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({ _id: journeyId, userId })
  if (!journey) return json({ error: "Not found" }, { status: 404 })

  // Explicit range (YYYY-MM-DD..YYYY-MM-DD) — used for the padded month grid and week view
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
  const start = url.searchParams.get("start")
  const end = url.searchParams.get("end")
  if (start || end) {
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return json({ error: "start and end must be YYYY-MM-DD with start <= end" }, { status: 400 })
    }
    const spanDays = (Date.parse(end) - Date.parse(start)) / 86400000
    if (spanDays > MAX_RANGE_DAYS) return json({ error: `Range cannot exceed ${MAX_RANGE_DAYS} days` }, { status: 400 })
    const { days, weeks, tdee } = await getCalendarDays(userId, journey, userTz, start, end)
    return json({ days, weeks, tdee })
  }

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

  const { days, weeks, tdee } = await getCalendarDays(userId, journey, userTz, firstDay, lastDay)
  return json({ year, month, days, weeks, tdee })
}
