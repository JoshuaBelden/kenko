// Double progression: work a weight until every working set hits the top of the rep
// range, then add weight and drop back to the bottom of the range.
export const REP_RANGE_MIN = 12
export const REP_RANGE_MAX = 15
export const WEIGHT_INCREMENT = 5

export type SetSuggestion = { weight: number; reps: number }

type PrevSet = { weight: number; reps: number; completed?: boolean }

/** Suggest weight/reps for the next session from one exercise's sets in its last session. */
export function suggestNextSet(prevSets: PrevSet[]): SetSuggestion | null {
  // Prefer sets the user checked off; older logs may have none flagged
  const done = prevSets.filter(s => s.completed)
  const sets = (done.length > 0 ? done : prevSets).filter(s => s.reps > 0)
  if (sets.length === 0) return null

  // Working weight = the weight used for the most sets (ties → heavier), which skips
  // warm-ups and one-off drop sets
  const counts = new Map<number, number>()
  for (const s of sets) counts.set(s.weight, (counts.get(s.weight) ?? 0) + 1)
  let weight = sets[0].weight
  for (const [w, c] of counts) {
    const best = counts.get(weight)!
    if (c > best || (c === best && w > weight)) weight = w
  }

  const workingReps = sets.filter(s => s.weight === weight).map(s => s.reps)
  const weakest = Math.min(...workingReps)

  // Bodyweight can't add load, so just keep adding reps
  if (weight === 0) return { weight, reps: Math.max(REP_RANGE_MIN, weakest + 1) }

  // Every working set topped out → add weight
  if (weakest >= REP_RANGE_MAX) {
    return { weight: weight + WEIGHT_INCREMENT, reps: REP_RANGE_MIN }
  }
  // Otherwise aim to beat the weakest set by one rep, within the range
  const reps = Math.min(REP_RANGE_MAX, Math.max(REP_RANGE_MIN, weakest + 1))
  return { weight, reps }
}
