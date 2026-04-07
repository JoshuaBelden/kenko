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
export type CommitmentType = "frequency" | "quantity" | "limit" | "recurring" | "taper"
export type CommitmentStatus = "scheduled" | "active" | "completed"

export interface TaperPhase {
  _id: ObjectId
  weekNumber: number
  label: string
  dailyLimit: number
}

export const VALID_DIRECTIONS: Direction[] = ["achieve", "limit"]
export const VALID_PERIODS: Period[] = ["daily", "weekly", "monthly", "journey_total"]
export const VALID_LOGGING_STYLES: LoggingStyle[] = ["checkbox", "quantity"]
export const VALID_COMMITMENT_TYPES: CommitmentType[] = ["frequency", "quantity", "limit", "recurring", "taper"]
export const VALID_COMMITMENT_STATUSES: CommitmentStatus[] = ["scheduled", "active", "completed"]

// ========================================
// Serializers
// ========================================

export function serializeCommitment(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    description: doc.description ?? null,
    type: doc.type ?? null,
    direction: doc.direction ?? null,
    period: doc.period ?? null,
    loggingStyle: doc.loggingStyle ?? null,
    targetValue: doc.targetValue ?? null,
    unit: doc.unit ?? null,
    startDate: doc.startDate instanceof Date ? doc.startDate.toISOString() : doc.startDate ?? null,
    status: doc.status ?? null,
    isActive: doc.isActive,
    taperPhases: doc.taperPhases
      ? doc.taperPhases.map((p: TaperPhase) => ({
          id: p._id.toString(),
          weekNumber: p.weekNumber,
          label: p.label,
          dailyLimit: p.dailyLimit,
        }))
      : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export function serializeCommitmentLog(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    commitmentId: doc.commitmentId.toString(),
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
  referenceDate?: Date,
): Promise<PeriodProgress> {
  const logs = await getCommitmentLogsCollection()
  const ref = referenceDate ?? new Date()

  const filter: Record<string, unknown> = { commitmentId, userId }

  switch (period) {
    case "daily":
      filter.date = { $gte: startOfDay(ref), $lte: endOfDay(ref) }
      break
    case "weekly":
      filter.date = { $gte: startOfWeek(ref), $lte: endOfDay(ref) }
      break
    case "monthly":
      filter.date = { $gte: startOfMonth(ref), $lte: endOfDay(ref) }
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

export async function getTodayLog(commitmentId: ObjectId, userId: ObjectId, referenceDate?: Date) {
  const logs = await getCommitmentLogsCollection()
  const ref = referenceDate ?? new Date()
  return logs.findOne({
    commitmentId,
    userId,
    date: { $gte: startOfDay(ref), $lte: endOfDay(ref) },
  })
}

// ========================================
// Taper helpers
// ========================================

export interface TaperPhaseStatus {
  id: string
  weekNumber: number
  label: string
  dailyLimit: number
  status: "upcoming" | "active" | "past"
}

export interface TaperProgress {
  currentPhase: { label: string; weekNumber: number; dailyLimit: number } | null
  todayValue: number
  todayLimit: number | null
  overallProgress: { currentWeek: number; totalWeeks: number }
  nextPhase: { label: string; weekNumber: number; dailyLimit: number; daysUntilStart: number } | null
  phaseSchedule: TaperPhaseStatus[]
  status: "scheduled" | "active" | "completed" | "beyond_phases"
  daysUntilStart: number | null
}

export function calculateTaperPhaseInfo(
  startDate: Date,
  taperPhases: TaperPhase[],
  commitmentStatus: string,
  referenceDate?: Date,
): { weeksElapsed: number; activePhase: TaperPhase | null; status: string } {
  const now = startOfDay(referenceDate ?? new Date())
  const start = startOfDay(startDate)
  const diffMs = now.getTime() - start.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) {
    return { weeksElapsed: 0, activePhase: null, status: "scheduled" }
  }

  if (commitmentStatus === "completed") {
    return { weeksElapsed: Math.floor(diffDays / 7), activePhase: null, status: "completed" }
  }

  const weeksElapsed = Math.floor(diffDays / 7)
  const activePhase = taperPhases.find((p) => p.weekNumber === weeksElapsed + 1) ?? null

  if (!activePhase) {
    return { weeksElapsed, activePhase: null, status: "beyond_phases" }
  }

  return { weeksElapsed, activePhase, status: "active" }
}

export async function getTaperProgress(
  commitmentId: ObjectId,
  userId: ObjectId,
  startDate: Date,
  taperPhases: TaperPhase[],
  commitmentStatus: string,
  referenceDate?: Date,
): Promise<TaperProgress> {
  const ref = referenceDate ?? new Date()
  const sortedPhases = [...taperPhases].sort((a, b) => a.weekNumber - b.weekNumber)
  const totalWeeks = sortedPhases.length > 0 ? sortedPhases[sortedPhases.length - 1].weekNumber : 0

  const { weeksElapsed, activePhase, status } = calculateTaperPhaseInfo(startDate, sortedPhases, commitmentStatus, ref)

  // Get log for reference date
  const todayLog = await getTodayLog(commitmentId, userId, ref)
  const todayValue = todayLog?.value ?? 0

  // Days until start (if scheduled)
  const now = startOfDay(ref)
  const start = startOfDay(startDate)
  const daysUntilStart = status === "scheduled"
    ? Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Current week number (1-based)
  const currentWeek = Math.min(weeksElapsed + 1, totalWeeks || 1)

  // Next phase
  let nextPhase: TaperProgress["nextPhase"] = null
  if (activePhase) {
    const next = sortedPhases.find((p) => p.weekNumber === activePhase.weekNumber + 1)
    if (next) {
      const daysIntoCurrentWeek = Math.floor(
        ((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) % 7,
      )
      nextPhase = {
        label: next.label,
        weekNumber: next.weekNumber,
        dailyLimit: next.dailyLimit,
        daysUntilStart: 7 - daysIntoCurrentWeek,
      }
    }
  }

  // Phase schedule with statuses
  const phaseSchedule: TaperPhaseStatus[] = sortedPhases.map((p) => ({
    id: p._id.toString(),
    weekNumber: p.weekNumber,
    label: p.label,
    dailyLimit: p.dailyLimit,
    status:
      status === "completed"
        ? "past"
        : p.weekNumber < weeksElapsed + 1
          ? "past"
          : p.weekNumber === weeksElapsed + 1
            ? "active"
            : "upcoming",
  }))

  return {
    currentPhase: activePhase
      ? { label: activePhase.label, weekNumber: activePhase.weekNumber, dailyLimit: activePhase.dailyLimit }
      : null,
    todayValue,
    todayLimit: activePhase?.dailyLimit ?? null,
    overallProgress: { currentWeek, totalWeeks },
    nextPhase,
    phaseSchedule,
    status: status as TaperProgress["status"],
    daysUntilStart,
  }
}

export async function getTaperDailyHistory(
  commitmentId: ObjectId,
  userId: ObjectId,
  startDate: Date,
  taperPhases: TaperPhase[],
): Promise<Array<{ date: string; value: number; dailyLimit: number; met: boolean }>> {
  const logsCol = await getCommitmentLogsCollection()
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29)

  const rangeStart = startOfDay(thirtyDaysAgo)
  const rangeEnd = endOfDay(now)

  const allLogs = await logsCol
    .find({ commitmentId, userId, date: { $gte: rangeStart, $lte: rangeEnd } })
    .sort({ date: 1 })
    .toArray()

  const logMap = new Map(
    allLogs.map((log) => [
      (log.date instanceof Date ? log.date : new Date(log.date)).toISOString().slice(0, 10),
      log.value,
    ]),
  )

  const sortedPhases = [...taperPhases].sort((a, b) => a.weekNumber - b.weekNumber)
  const start = startOfDay(startDate)
  const days: Array<{ date: string; value: number; dailyLimit: number; met: boolean }> = []

  for (let i = 0; i < 30; i++) {
    const d = new Date(rangeStart)
    d.setUTCDate(d.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const value = logMap.get(dateStr) ?? 0

    // Determine which phase this day falls in
    const diffDays = (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    let dailyLimit = 0
    if (diffDays >= 0) {
      const weekNum = Math.floor(diffDays / 7) + 1
      const phase = sortedPhases.find((p) => p.weekNumber === weekNum)
      dailyLimit = phase?.dailyLimit ?? sortedPhases[sortedPhases.length - 1]?.dailyLimit ?? 0
    }

    days.push({
      date: dateStr,
      value,
      dailyLimit,
      met: value <= dailyLimit,
    })
  }

  return days
}
