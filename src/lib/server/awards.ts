import { calculateTaperPhaseInfo, type TaperPhase } from "$lib/server/kata"
import type { Document, WithId } from "mongodb"

// ========================================
// Thresholds — tune here
// ========================================

/** Calories: hit when consumed is within [min, max] of target; close within the wider band */
const CALORIE_HIT = { min: 0.9, max: 1.05 }
const CALORIE_CLOSE = { min: 0.8, max: 1.15 }
/** Protein / water / weekly targets: close at or above this fraction of target */
const CLOSE_FRACTION = 0.8
/** A day needs at least this many goals configured to earn a sticker */
const MIN_DAILY_GOALS = 2
/** Week medal thresholds on the combined 0–1 score */
const MEDAL_THRESHOLDS = { gold: 0.85, silver: 0.65, bronze: 0.45 }
const TIER_POINTS = { perfect: 1, outstanding: 0.5 }

// ========================================
// Types
// ========================================

export type GoalStatus = "hit" | "close" | "miss"
export type DayTier = "perfect" | "outstanding"
export type Medal = "gold" | "silver" | "bronze"

export interface GoalResult {
  key: string
  label: string
  status: GoalStatus
  detail: string
}

export interface DayAward {
  tier: DayTier | null
  goals: GoalResult[]
}

export interface WeekAward {
  medal: Medal | null
  score: number
  dayScore: number | null
  targetScore: number | null
  stickerDays: number
  targets: GoalResult[]
}

interface CommitmentGoal {
  id: string
  name: string
  direction: "achieve" | "limit"
  targetValue: number
  startDateStr: string | null
  taper: { startDate: Date; phases: TaperPhase[] } | null
}

export interface AwardGoals {
  calorieTarget: number | null
  proteinTarget: number | null
  waterTarget: number | null
  dailyCommitments: CommitmentGoal[]
  weeklyCommitments: CommitmentGoal[]
  sessionsPerWeek: number | null
  weeklyFastingHours: number | null
  weeklyCalorieBurn: number | null
}

// ========================================
// Goal building
// ========================================

export function buildAwardGoals(
  journey: WithId<Document>,
  commitmentDocs: WithId<Document>[],
  dateStrOf: (d: Date) => string,
): AwardGoals {
  const s = journey.shokuTargets
  const calorieTarget = s?.dailyCalorieTarget || null
  const protein = s?.macros?.protein
  const proteinTarget =
    protein?.grams || (protein?.percentage && calorieTarget ? Math.round((protein.percentage / 100) * calorieTarget / 4) : null)

  const toGoal = (c: WithId<Document>): CommitmentGoal => {
    const startDate = c.startDate ? new Date(c.startDate) : null
    const isTaper = c.type === "taper" && (c.taperPhases?.length ?? 0) > 0 && startDate
    return {
      id: c._id.toString(),
      name: c.name,
      // Tapers have no direction and always cap a daily amount
      direction: c.type === "taper" ? "limit" : c.direction === "limit" ? "limit" : "achieve",
      targetValue: c.targetValue ?? (c.loggingStyle === "checkbox" ? 1 : 0),
      startDateStr: startDate ? dateStrOf(startDate) : null,
      taper: isTaper ? { startDate: startDate!, phases: [...c.taperPhases].sort((a: any, b: any) => a.weekNumber - b.weekNumber) } : null,
    }
  }

  const active = commitmentDocs.filter((c) => c.isActive !== false)
  return {
    calorieTarget,
    proteinTarget: proteinTarget || null,
    waterTarget: s?.dailyWaterTargetOz || null,
    dailyCommitments: active.filter((c) => c.period === "daily" || c.type === "taper").map(toGoal),
    weeklyCommitments: active.filter((c) => c.period === "weekly" && c.type !== "taper").map(toGoal),
    sessionsPerWeek: journey.dojoTargets?.sessionsPerWeek || null,
    weeklyFastingHours: journey.danjikiTargets?.weeklyFastingHours || null,
    weeklyCalorieBurn: journey.dojoTargets?.weeklyCalorieBurn || null,
  }
}

// ========================================
// Helpers
// ========================================

export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

function pct(value: number, target: number): number {
  return target > 0 ? Math.round((value / target) * 100) : 0
}

/** Status for a "reach at least" target */
function atLeast(value: number, target: number): GoalStatus {
  if (value >= target) return "hit"
  if (value >= target * CLOSE_FRACTION) return "close"
  return "miss"
}

/** Daily limit for a commitment on a date; null when it doesn't apply that day */
function dailyTargetFor(c: CommitmentGoal, dateStr: string): number | null {
  if (c.startDateStr && dateStr < c.startDateStr) return null
  if (!c.taper) return c.targetValue
  const ref = new Date(`${dateStr}T12:00:00.000Z`)
  const { activePhase, status } = calculateTaperPhaseInfo(c.taper.startDate, c.taper.phases, "active", ref)
  if (status === "scheduled") return null
  return activePhase?.dailyLimit ?? c.taper.phases[c.taper.phases.length - 1].dailyLimit
}

function commitmentMet(direction: "achieve" | "limit", value: number, target: number): boolean {
  return direction === "achieve" ? value >= target : value <= target
}

/** Direction-aware count of daily commitments met on a date */
export function dailyCommitmentsMet(goals: AwardGoals, dateStr: string, values: Record<string, number>) {
  let met = 0
  let total = 0
  for (const c of goals.dailyCommitments) {
    const target = dailyTargetFor(c, dateStr)
    if (target == null) continue
    total++
    if (commitmentMet(c.direction, values[c.id] ?? 0, target)) met++
  }
  return { met, total }
}

// ========================================
// Day evaluation
// ========================================

export function evaluateDay(day: Record<string, any> | null, goals: AwardGoals, dateStr: string): DayAward {
  const results: GoalResult[] = []
  const consumed = day?.caloriesConsumed ?? 0
  const foodLogged = consumed > 0

  if (goals.calorieTarget) {
    const ratio = consumed / goals.calorieTarget
    const status: GoalStatus = !foodLogged
      ? "miss"
      : ratio >= CALORIE_HIT.min && ratio <= CALORIE_HIT.max
        ? "hit"
        : ratio >= CALORIE_CLOSE.min && ratio <= CALORIE_CLOSE.max
          ? "close"
          : "miss"
    results.push({ key: "calories", label: "Calories", status, detail: foodLogged ? `${pct(consumed, goals.calorieTarget)}%` : "not logged" })
  }

  if (goals.proteinTarget) {
    const protein = day?.proteinConsumed ?? 0
    results.push({
      key: "protein",
      label: "Protein",
      status: foodLogged ? atLeast(protein, goals.proteinTarget) : "miss",
      detail: foodLogged ? `${pct(protein, goals.proteinTarget)}%` : "not logged",
    })
  }

  if (goals.waterTarget) {
    const water = day?.waterOz ?? 0
    results.push({ key: "water", label: "Water", status: atLeast(water, goals.waterTarget), detail: `${pct(water, goals.waterTarget)}%` })
  }

  const { met, total } = dailyCommitmentsMet(goals, dateStr, day?.commitments ?? {})
  if (total > 0) {
    const missed = total - met
    const status: GoalStatus = missed === 0 ? "hit" : missed === 1 && met >= 1 ? "close" : "miss"
    results.push({ key: "habits", label: "Habits", status, detail: `${met}/${total}` })
  }

  let tier: DayTier | null = null
  if (results.length >= MIN_DAILY_GOALS && results.every((r) => r.status !== "miss")) {
    tier = results.every((r) => r.status === "hit") ? "perfect" : "outstanding"
  }
  return { tier, goals: results }
}

// ========================================
// Week evaluation
// ========================================

/**
 * Scores a Monday–Sunday week. `eligibleDates` are the week's dates that fall
 * inside the journey; weekly targets are only scored when the full week does.
 */
export function evaluateWeek(
  weekDates: string[],
  eligibleDates: string[],
  days: Record<string, any>,
  goals: AwardGoals,
): WeekAward {
  const awards = eligibleDates.map((d) => days[d]?.award?.tier ?? null)
  const stickerDays = awards.filter(Boolean).length
  const dailyGoalCount =
    [goals.calorieTarget, goals.proteinTarget, goals.waterTarget].filter(Boolean).length +
    (goals.dailyCommitments.length > 0 ? 1 : 0)
  const dayScore =
    eligibleDates.length > 0 && dailyGoalCount >= MIN_DAILY_GOALS
      ? awards.reduce((s: number, t: DayTier | null) => s + (t ? TIER_POINTS[t] : 0), 0) / eligibleDates.length
      : null

  const targets: GoalResult[] = []
  if (eligibleDates.length === weekDates.length) {
    const weekDays = weekDates.map((d) => days[d]).filter(Boolean)
    const sum = (fn: (d: any) => number) => weekDays.reduce((s, d) => s + fn(d), 0)

    if (goals.sessionsPerWeek) {
      const sessions = sum((d) => d.workouts?.length ?? 0)
      targets.push({ key: "sessions", label: "Workouts", status: atLeast(sessions, goals.sessionsPerWeek), detail: `${sessions}/${goals.sessionsPerWeek}` })
    }
    if (goals.weeklyFastingHours) {
      const hours = Math.round(sum((d) => d.fastHours ?? 0) * 10) / 10
      targets.push({ key: "fasting", label: "Fasting", status: atLeast(hours, goals.weeklyFastingHours), detail: `${hours}/${goals.weeklyFastingHours}h` })
    }
    if (goals.weeklyCalorieBurn) {
      const burned = sum((d) => d.caloriesBurned ?? 0)
      targets.push({ key: "burn", label: "Burn", status: atLeast(burned, goals.weeklyCalorieBurn), detail: `${pct(burned, goals.weeklyCalorieBurn)}%` })
    }
    for (const c of goals.weeklyCommitments) {
      if (c.startDateStr && weekDates[6] < c.startDateStr) continue
      const value = sum((d) => d.commitments?.[c.id] ?? 0)
      const status: GoalStatus =
        c.direction === "achieve" ? atLeast(value, c.targetValue) : value <= c.targetValue ? "hit" : "miss"
      targets.push({ key: `habit-${c.id}`, label: c.name, status, detail: `${value}/${c.targetValue}` })
    }
  }

  const targetScore =
    targets.length > 0
      ? targets.reduce((s, t) => s + (t.status === "hit" ? 1 : t.status === "close" ? 0.5 : 0), 0) / targets.length
      : null

  const parts = [dayScore, targetScore].filter((v): v is number => v != null)
  const score = parts.length > 0 ? parts.reduce((s, v) => s + v, 0) / parts.length : 0
  const medal: Medal | null =
    parts.length === 0
      ? null
      : score >= MEDAL_THRESHOLDS.gold
        ? "gold"
        : score >= MEDAL_THRESHOLDS.silver
          ? "silver"
          : score >= MEDAL_THRESHOLDS.bronze
            ? "bronze"
            : null

  return { medal, score: Math.round(score * 100) / 100, dayScore, targetScore, stickerDays, targets }
}
