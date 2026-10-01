export interface WorkoutType {
  key: string
  label: string
}

export const DEFAULT_WORKOUT_TYPES: WorkoutType[] = [
  { key: "run", label: "Run" },
  { key: "hike", label: "Hike" },
  { key: "cycle", label: "Cycle" },
  { key: "row", label: "Row" },
  { key: "swim", label: "Swim" },
  { key: "other", label: "Other" },
]

export const WORKOUT_TYPE_LABEL_MAX_LENGTH = 40
export const WORKOUT_TYPES_MAX_COUNT = 50

const KEY_PATTERN = /^[a-z0-9_]{1,40}$/

export function isWorkoutTypeKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value)
}

/** Derives a stable storage key from a user-entered label, e.g. "Rock Climbing" → "rock_climbing". */
export function workoutTypeKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
}

/** Label for a stored key — looks in the given list, then the defaults, then humanizes the key. */
export function workoutTypeLabel(
  key: string | null | undefined,
  types: WorkoutType[] = DEFAULT_WORKOUT_TYPES,
): string {
  if (!key) return "Cardio"
  const found = types.find((t) => t.key === key) ?? DEFAULT_WORKOUT_TYPES.find((t) => t.key === key)
  if (found) return found.label
  const words = key.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
