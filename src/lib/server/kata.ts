import type { Document, ObjectId, WithId } from "mongodb"
import { getDb } from "./db"

// ========================================
// Collections
// ========================================

export async function getCommitmentsCollection() {
  const db = await getDb()
  return db.collection("commitments")
}

export async function getCommitmentLogsCollection() {
  const db = await getDb()
  return db.collection("commitmentLogs")
}

// ========================================
// Types
// ========================================

export type Direction = "achieve" | "limit"
export type Period = "daily" | "weekly" | "monthly" | "journey_total"
export type LoggingStyle = "checkbox" | "quantity"

export const VALID_DIRECTIONS: Direction[] = ["achieve", "limit"]
export const VALID_PERIODS: Period[] = ["daily", "weekly", "monthly", "journey_total"]
export const VALID_LOGGING_STYLES: LoggingStyle[] = ["checkbox", "quantity"]

// ========================================
// Serializers
// ========================================

export function serializeCommitment(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    journeyId: doc.journeyId ? doc.journeyId.toString() : null,
    name: doc.name,
    description: doc.description ?? null,
    direction: doc.direction,
    period: doc.period,
    loggingStyle: doc.loggingStyle,
    targetValue: doc.targetValue,
    unit: doc.unit ?? null,
    isActive: doc.isActive,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export function serializeCommitmentLog(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    commitmentId: doc.commitmentId.toString(),
    journeyId: doc.journeyId ? doc.journeyId.toString() : null,
    date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
    value: doc.value,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

// ========================================
// Date helpers
// ========================================

/** Returns start of today (midnight UTC) */
function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Returns end of today (23:59:59.999 UTC) */
function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

/** Returns Monday of the current week (UTC) */
function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0 offset
  d.setUTCDate(d.getUTCDate() - diff)
  return d
}

/** Returns 1st of the current month (UTC) */
function startOfMonth(date: Date): Date {
  const d = startOfDay(date)
  d.setUTCDate(1)
  return d
}

// ========================================
// Period progress calculation
// ========================================

export interface PeriodProgress {
  current: number
  target: number
  percentage: number
}

export async function calculatePeriodProgress(
  commitmentId: ObjectId,
  userId: ObjectId,
  period: Period,
  targetValue: number,
  journeyStartDate?: Date | null,
): Promise<PeriodProgress> {
  const logs = await getCommitmentLogsCollection()
  const now = new Date()

  const filter: Record<string, unknown> = { commitmentId, userId }

  switch (period) {
    case "daily":
      filter.date = { $gte: startOfDay(now), $lte: endOfDay(now) }
      break
    case "weekly":
      filter.date = { $gte: startOfWeek(now), $lte: endOfDay(now) }
      break
    case "monthly":
      filter.date = { $gte: startOfMonth(now), $lte: endOfDay(now) }
      break
    case "journey_total":
      if (journeyStartDate) {
        filter.date = { $gte: startOfDay(journeyStartDate) }
      }
      // If evergreen (no journeyStartDate), sum all logs — no date filter
      break
  }

  const result = await logs
    .aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$value" } } }])
    .toArray()

  const current = result.length > 0 ? result[0].total : 0
  const percentage = targetValue > 0 ? Math.round((current / targetValue) * 100) : 0

  return { current, target: targetValue, percentage }
}

// ========================================
// Period history
// ========================================

export interface HistoryEntry {
  label: string
  start: string
  end: string
  value: number
  target: number
  met: boolean
}

export interface JourneyTotalHistory {
  cumulativeTotal: number
  entries: Array<{
    date: string
    value: number
    cumulativeAtDate: number
  }>
}

export async function getPeriodHistory(
  commitmentId: ObjectId,
  userId: ObjectId,
  period: Period,
  targetValue: number,
  direction: Direction,
  journeyStartDate?: Date | null,
): Promise<{ periods: HistoryEntry[]; journeyTotal: JourneyTotalHistory | null }> {
  const logsCol = await getCommitmentLogsCollection()
  const now = new Date()

  if (period === "journey_total") {
    const filter: Record<string, unknown> = { commitmentId, userId }
    if (journeyStartDate) {
      filter.date = { $gte: startOfDay(journeyStartDate) }
    }

    const allLogs = await logsCol.find(filter).sort({ date: 1 }).toArray()
    let cumulative = 0
    const entries = allLogs.map((log) => {
      cumulative += log.value
      return {
        date: log.date instanceof Date ? log.date.toISOString() : log.date,
        value: log.value,
        cumulativeAtDate: cumulative,
      }
    })

    return {
      periods: [],
      journeyTotal: { cumulativeTotal: cumulative, entries },
    }
  }

  const ranges: Array<{ label: string; start: Date; end: Date }> = []

  if (period === "daily") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - i)
      const s = startOfDay(d)
      const e = endOfDay(d)
      const label = s.toISOString().slice(0, 10)
      ranges.push({ label, start: s, end: e })
    }
  } else if (period === "weekly") {
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(now)
      weekStart.setUTCDate(weekStart.getUTCDate() - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
      const e = endOfDay(weekEnd)
      const label = weekStart.toISOString().slice(0, 10)
      ranges.push({ label, start: weekStart, end: e })
    }
  } else if (period === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now)
      monthStart.setUTCMonth(monthStart.getUTCMonth() - i, 1)
      const s = startOfDay(monthStart)
      const monthEnd = new Date(s)
      monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1)
      monthEnd.setUTCDate(0) // last day of the month
      const e = endOfDay(monthEnd)
      const label = s.toISOString().slice(0, 7) // YYYY-MM
      ranges.push({ label, start: s, end: e })
    }
  }

  // Fetch all logs in the full range at once
  const earliest = ranges[0]?.start
  const latest = ranges[ranges.length - 1]?.end
  if (!earliest || !latest) return { periods: [], journeyTotal: null }

  const allLogs = await logsCol
    .find({ commitmentId, userId, date: { $gte: earliest, $lte: latest } })
    .sort({ date: 1 })
    .toArray()

  const periods: HistoryEntry[] = ranges.map((range) => {
    const logsInRange = allLogs.filter(
      (log) => log.date >= range.start && log.date <= range.end,
    )
    const value = logsInRange.reduce((sum, log) => sum + log.value, 0)
    const met =
      direction === "achieve" ? value >= targetValue : value <= targetValue

    return {
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      value,
      target: targetValue,
      met,
    }
  })

  return { periods, journeyTotal: null }
}

// ========================================
// Today's log helpers
// ========================================

export async function getTodayLog(commitmentId: ObjectId, userId: ObjectId) {
  const logs = await getCommitmentLogsCollection()
  const now = new Date()
  return logs.findOne({
    commitmentId,
    userId,
    date: { $gte: startOfDay(now), $lte: endOfDay(now) },
  })
}
