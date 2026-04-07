/**
 * Client-side timezone helpers.
 *
 * These utilities convert date-picker / time-picker values into full ISO
 * datetime strings that carry the user's timezone offset, and extract
 * local date/time parts from ISO strings or Date objects.
 */

/**
 * Get the UTC offset string (e.g. "-07:00", "+05:30") for a given
 * date+time in a given IANA timezone.
 */
function tzOffset(dateStr: string, timeStr: string, tz: string): string {
  // Build a Date from the components interpreted as UTC, then compare
  // what Intl says the local time is in the target timezone.
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)

  // Create a reference date roughly in the right zone
  const refUtc = Date.UTC(year, month - 1, day, hour, minute)

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

  const parts = fmt.formatToParts(new Date(refUtc))
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "0"

  const localYear = Number(p("year"))
  const localMonth = Number(p("month"))
  const localDay = Number(p("day"))
  let localHour = Number(p("hour"))
  if (localHour === 24) localHour = 0
  const localMinute = Number(p("minute"))
  const localSecond = Number(p("second"))

  const localAsUtc = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, localSecond)
  const offsetMs = localAsUtc - refUtc
  const totalMinutes = offsetMs / 60000
  const sign = totalMinutes >= 0 ? "+" : "-"
  const absMin = Math.abs(totalMinutes)
  const oh = String(Math.floor(absMin / 60)).padStart(2, "0")
  const om = String(absMin % 60).padStart(2, "0")

  return `${sign}${oh}:${om}`
}

/**
 * Combine YYYY-MM-DD + HH:mm + IANA timezone → full ISO with offset.
 *
 * e.g. toDatetime("2026-04-06", "08:00", "America/Los_Angeles")
 *    → "2026-04-06T08:00:00.000-07:00"
 */
export function toDatetime(dateStr: string, timeStr: string, tz: string): string {
  const offset = tzOffset(dateStr, timeStr, tz)
  return `${dateStr}T${timeStr}:00.000${offset}`
}

/**
 * Today's date as YYYY-MM-DD in the given timezone.
 */
export function localToday(tz: string): string {
  return localDateStr(new Date(), tz)
}

/**
 * Current time as HH:mm in the given timezone.
 */
export function localTimeNow(tz: string): string {
  return localTimeStr(new Date(), tz)
}

/**
 * Format a Date or ISO string to YYYY-MM-DD in the given timezone.
 */
export function localDateStr(date: Date | string, tz: string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(d) // en-CA formats as YYYY-MM-DD
}

/**
 * Format a Date or ISO string to HH:mm in the given timezone.
 */
export function localTimeStr(date: Date | string, tz: string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return fmt.format(d) // en-GB gives HH:mm in 24h
}
