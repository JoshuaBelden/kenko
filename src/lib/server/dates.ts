/**
 * Server-side timezone helpers.
 *
 * Convert between IANA-timezone-aware calendar boundaries and UTC Dates
 * for MongoDB queries.
 */

/**
 * Get the UTC offset in milliseconds for a given IANA timezone at a
 * specific instant.
 */
function getOffsetMs(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = fmt.formatToParts(date)
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "0"

  const localYear = Number(p("year"))
  const localMonth = Number(p("month"))
  const localDay = Number(p("day"))
  let localHour = Number(p("hour"))
  if (localHour === 24) localHour = 0
  const localMinute = Number(p("minute"))
  const localSecond = Number(p("second"))

  const localAsUtc = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, localSecond)
  return localAsUtc - date.getTime()
}

/**
 * Today as YYYY-MM-DD in the given timezone.
 */
export function todayStr(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(new Date()) // en-CA → YYYY-MM-DD
}

/**
 * Start of day (00:00:00.000) for a given YYYY-MM-DD in the specified
 * timezone, returned as a UTC Date suitable for MongoDB queries.
 */
export function startOfDayTz(dateStr: string, tz: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  // Start with midnight UTC on that calendar date
  const guessUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  // The offset tells us how far ahead/behind the timezone is from UTC
  const offset = getOffsetMs(guessUtc, tz)
  // Midnight in the timezone = midnight UTC minus the offset
  const result = new Date(guessUtc.getTime() - offset)
  // Verify: the offset might differ at the result time (DST edge).
  // Re-check and correct if needed.
  const offset2 = getOffsetMs(result, tz)
  if (offset2 !== offset) {
    return new Date(guessUtc.getTime() - offset2)
  }
  return result
}

/**
 * End of day (23:59:59.999) for a given YYYY-MM-DD in the specified
 * timezone, returned as a UTC Date suitable for MongoDB queries.
 */
export function endOfDayTz(dateStr: string, tz: string): Date {
  const start = startOfDayTz(dateStr, tz)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

/**
 * Start of week (Monday 00:00:00.000) for the week containing `date`,
 * in the specified timezone.
 */
export function startOfWeekTz(date: Date, tz: string): Date {
  // Find the local day-of-week
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = fmt.formatToParts(date)
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? ""

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dow = dayNames.indexOf(p("weekday"))
  // Monday = 0 offset; Sunday wraps to 6
  const diff = dow === 0 ? 6 : dow - 1

  const year = Number(p("year"))
  const month = Number(p("month"))
  const day = Number(p("day"))

  // Build the Monday date string
  const mondayDate = new Date(Date.UTC(year, month - 1, day - diff))
  const mondayStr = `${mondayDate.getUTCFullYear()}-${String(mondayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(mondayDate.getUTCDate()).padStart(2, "0")}`

  return startOfDayTz(mondayStr, tz)
}

/**
 * End of week (Sunday 23:59:59.999) for the week containing `date`,
 * in the specified timezone.
 */
export function endOfWeekTz(date: Date, tz: string): Date {
  const weekStart = startOfWeekTz(date, tz)
  // Sunday end = Monday start + 7 days - 1ms
  return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
}
