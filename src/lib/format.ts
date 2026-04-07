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
