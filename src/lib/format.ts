export function formatDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: tz,
  })
}

export function formatDateShort(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  })
}

export function formatDateRange(start: string, end: string, tz: string): string {
  return `${formatDateShort(start, tz)} — ${formatDateShort(end, tz)}`
}

export function formatPace(minutesPerMile: number | null | undefined): string {
  if (minutesPerMile == null || !isFinite(minutesPerMile) || minutesPerMile <= 0) return "—"
  const totalSeconds = Math.round(minutesPerMile * 60)
  const min = Math.floor(totalSeconds / 60)
  const sec = totalSeconds % 60
  return `${min}:${sec.toString().padStart(2, "0")} min/mile`
}

export function formatDuration(
  startedAt: string | Date | null | undefined,
  completedAt: string | Date | null | undefined,
): string {
  if (!startedAt || !completedAt) return "—"
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt)
  const end = completedAt instanceof Date ? completedAt : new Date(completedAt)
  const ms = end.getTime() - start.getTime()
  if (!isFinite(ms) || ms < 0) return "—"
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

export function cardioTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "run":
      return "Run"
    case "cycle":
      return "Cycle"
    case "row":
      return "Row"
    case "swim":
      return "Swim"
    case "other":
      return "Other"
    default:
      return "Cardio"
  }
}
