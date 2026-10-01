// Shared (client + server) types for AI-generated workout plan drafts.

export type MuscleRegion = "torso" | "arms" | "lower_body"

export type Muscle =
  | "chest"
  | "abs"
  | "back"
  | "lower_back"
  | "trapezius"
  | "neck"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "abductors"
  | "adductors"

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "medicine_ball"
  | "resistance_band"
  | "bodyweight"
  | "other"

export interface DraftExercise {
  /** Library exercise id; null when the exercise is new and will be created on apply. */
  exerciseId: string | null
  name: string
  muscle: Muscle
  region: MuscleRegion
  equipment: Equipment
  isNew: boolean
  targetSets: number
  targetReps: number
  restSeconds: number
  note: string | null
}

export interface DraftSession {
  name: string
  targetDayOfWeek: number | null
  exercises: DraftExercise[]
}

export interface PlanDraft {
  name: string
  summary: string
  sessions: DraftSession[]
}

export type DraftMessage = { role: "user" | "assistant"; content: string }

export const PLAN_GENERATOR_MAX_USER_TURNS = 10
export const PLAN_GENERATOR_MAX_MESSAGE_LENGTH = 4000

export function countNewExercises(draft: PlanDraft): number {
  const names = new Set<string>()
  for (const s of draft.sessions) {
    for (const e of s.exercises) if (e.isNew) names.add(e.name.toLowerCase())
  }
  return names.size
}
