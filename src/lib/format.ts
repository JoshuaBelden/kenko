export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} \u2014 ${formatDate(end)}`
}
