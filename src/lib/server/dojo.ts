import type { Document, Filter, ObjectId, WithId } from "mongodb"
import { getDb } from "./db"

// ========================================
// Collections
// ========================================

export async function getExercisesCollection() {
  const db = await getDb()
  return db.collection("exercises")
}

export async function getWorkoutPlansCollection() {
  const db = await getDb()
  return db.collection("workoutPlans")
}

export async function getWorkoutLogsCollection() {
  const db = await getDb()
  return db.collection("workoutLogs")
}

// ========================================
// Types
// ========================================

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

export type SessionType = "strength" | "cardio"

export const VALID_REGIONS: MuscleRegion[] = ["torso", "arms", "lower_body"]

export const MUSCLES_BY_REGION: Record<MuscleRegion, Muscle[]> = {
  torso: ["chest", "abs", "back", "lower_back", "trapezius", "neck"],
  arms: ["shoulders", "biceps", "triceps", "forearms"],
  lower_body: ["glutes", "quads", "hamstrings", "calves", "abductors", "adductors"],
}

export const ALL_MUSCLES: Muscle[] = Object.values(MUSCLES_BY_REGION).flat()

export const VALID_EQUIPMENT: Equipment[] = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "resistance_band",
  "bodyweight",
  "other",
]

// ========================================
// Serializers
// ========================================

export function exerciseFilterForUser(userId: ObjectId): Filter<Document> {
  return { $or: [{ isGlobal: true }, { userId }] }
}

export function serializeExercise(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    isGlobal: doc.isGlobal ?? false,
    name: doc.name,
    muscleGroup: doc.muscleGroup ?? { region: "torso", muscle: "chest" },
    equipment: doc.equipment ?? "bodyweight",
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export function serializeWorkoutPlan(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    sessions: (doc.sessions ?? []).map((s: any) => ({
      id: s._id?.toString() ?? s.id,
      name: s.name,
      type: s.type ?? "strength",
      targetDayOfWeek: s.targetDayOfWeek ?? null,
      exercises: (s.exercises ?? []).map((e: any) => ({
        id: e._id?.toString() ?? e.id,
        exerciseId: e.exerciseId?.toString() ?? e.exerciseId,
        order: e.order ?? 0,
        targetSets: e.targetSets ?? 3,
        targetReps: e.targetReps ?? 10,
        targetWeight: e.targetWeight ?? null,
        restSeconds: e.restSeconds ?? 90,
      })),
    })),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export function serializeWorkoutLog(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    planId: doc.planId?.toString() ?? null,
    planSnapshot: doc.planSnapshot
      ? {
          planName: doc.planSnapshot.planName,
          sessionName: doc.planSnapshot.sessionName,
          sessionType: doc.planSnapshot.sessionType ?? "strength",
          exercises: (doc.planSnapshot.exercises ?? []).map((e: any) => ({
            exerciseId: e.exerciseId?.toString() ?? e.exerciseId,
            exerciseName: e.exerciseName,
            muscleGroup: e.muscleGroup,
            equipment: e.equipment,
            order: e.order ?? 0,
            targetSets: e.targetSets ?? 3,
            targetReps: e.targetReps ?? 10,
            targetWeight: e.targetWeight ?? null,
            restSeconds: e.restSeconds ?? 90,
          })),
        }
      : null,
    sets: (doc.sets ?? []).map((s: any) => ({
      id: s._id?.toString() ?? s.id,
      exerciseId: s.exerciseId?.toString() ?? s.exerciseId,
      setNumber: s.setNumber,
      weight: s.weight ?? 0,
      reps: s.reps ?? 0,
      rpe: s.rpe ?? null,
      isAdditional: s.isAdditional ?? false,
      completed: s.completed ?? false,
    })),
    notes: doc.notes ?? null,
    caloriesBurned: doc.caloriesBurned ?? null,
    cardioDistance: doc.cardioDistance ?? null,
    status: doc.status ?? "in_progress",
    startedAt: doc.startedAt instanceof Date ? doc.startedAt.toISOString() : doc.startedAt,
    completedAt: doc.completedAt instanceof Date ? doc.completedAt.toISOString() : (doc.completedAt ?? null),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

// ========================================
// Helpers
// ========================================

export async function startWorkoutLog(
  userId: ObjectId,
  planId: ObjectId,
  sessionId: string,
) {
  const plans = await getWorkoutPlansCollection()
  const plan = await plans.findOne({ _id: planId, userId })
  if (!plan) return null

  const session = (plan.sessions ?? []).find((s: any) => s._id?.toString() === sessionId)
  if (!session) return null

  const sessionType = session.type ?? "strength"
  let snapshotExercises: any[] = []
  let initialSets: any[] = []

  if (sessionType === "strength") {
    // Resolve exercise names for the snapshot
    const exercises = await getExercisesCollection()
    const exerciseIds = (session.exercises ?? []).map((e: any) => e.exerciseId)
    const exerciseDocs = await exercises.find({ _id: { $in: exerciseIds } }).toArray()
    const exerciseMap = new Map(exerciseDocs.map(d => [d._id.toString(), d]))

    snapshotExercises = (session.exercises ?? []).map((e: any) => {
      const ex = exerciseMap.get(e.exerciseId?.toString())
      return {
        exerciseId: e.exerciseId,
        exerciseName: ex?.name ?? "Unknown",
        muscleGroup: ex?.muscleGroup ?? { region: "torso", muscle: "chest" },
        equipment: ex?.equipment ?? "bodyweight",
        order: e.order ?? 0,
        targetSets: e.targetSets ?? 3,
        targetReps: e.targetReps ?? 10,
        targetWeight: e.targetWeight ?? null,
        restSeconds: e.restSeconds ?? 90,
      }
    })

    // Pre-populate sets from exercise targets
    initialSets = snapshotExercises.flatMap((e: any) => {
      const count = e.targetSets ?? 3
      return Array.from({ length: count }, (_, i) => ({
        exerciseId: e.exerciseId,
        setNumber: i + 1,
        weight: e.targetWeight ?? 0,
        reps: e.targetReps ?? 10,
        rpe: null,
        isAdditional: false,
        completed: false,
      }))
    })
  }

  const now = new Date()

  const logs = await getWorkoutLogsCollection()
  const result = await logs.insertOne({
    userId,
    planId,
    planSnapshot: {
      planName: plan.name,
      sessionName: session.name,
      sessionType,
      exercises: snapshotExercises,
    },
    sets: initialSets,
    notes: null,
    caloriesBurned: null,
    cardioDistance: null,
    status: "in_progress",
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  })

  const created = await logs.findOne({ _id: result.insertedId })
  return created!
}
