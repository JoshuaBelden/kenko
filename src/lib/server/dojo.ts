import { ObjectId, type Document, type Filter, type WithId } from "mongodb"
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
    personalBests: doc.personalBests
      ? {
          bestSetVolume: doc.personalBests.bestSetVolume
            ? {
                value: doc.personalBests.bestSetVolume.value,
                achievedAt: doc.personalBests.bestSetVolume.achievedAt instanceof Date
                  ? doc.personalBests.bestSetVolume.achievedAt.toISOString()
                  : doc.personalBests.bestSetVolume.achievedAt,
                workoutLogId: doc.personalBests.bestSetVolume.workoutLogId?.toString() ?? null,
              }
            : null,
          bestE1RM: doc.personalBests.bestE1RM
            ? {
                value: doc.personalBests.bestE1RM.value,
                achievedAt: doc.personalBests.bestE1RM.achievedAt instanceof Date
                  ? doc.personalBests.bestE1RM.achievedAt.toISOString()
                  : doc.personalBests.bestE1RM.achievedAt,
                workoutLogId: doc.personalBests.bestE1RM.workoutLogId?.toString() ?? null,
              }
            : null,
          mostReps: doc.personalBests.mostReps
            ? {
                value: doc.personalBests.mostReps.value,
                achievedAt: doc.personalBests.mostReps.achievedAt instanceof Date
                  ? doc.personalBests.mostReps.achievedAt.toISOString()
                  : doc.personalBests.mostReps.achievedAt,
                workoutLogId: doc.personalBests.mostReps.workoutLogId?.toString() ?? null,
              }
            : null,
          heaviestWeight: doc.personalBests.heaviestWeight
            ? {
                value: doc.personalBests.heaviestWeight.value,
                achievedAt: doc.personalBests.heaviestWeight.achievedAt instanceof Date
                  ? doc.personalBests.heaviestWeight.achievedAt.toISOString()
                  : doc.personalBests.heaviestWeight.achievedAt,
                workoutLogId: doc.personalBests.heaviestWeight.workoutLogId?.toString() ?? null,
              }
            : null,
        }
      : null,
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
    performance: doc.performance
      ? {
          totalVolume: doc.performance.totalVolume,
          totalReps: doc.performance.totalReps,
          exercisePerformance: (doc.performance.exercisePerformance ?? []).map((ep: any) => ({
            exerciseId: ep.exerciseId?.toString() ?? ep.exerciseId,
            exerciseName: ep.exerciseName,
            isBodyweight: ep.isBodyweight ?? false,
            totalVolume: ep.totalVolume,
            totalReps: ep.totalReps,
            e1RM: ep.e1RM ?? null,
            personalBests: ep.personalBests ?? [],
          })),
          calculatedAt: doc.performance.calculatedAt instanceof Date
            ? doc.performance.calculatedAt.toISOString()
            : doc.performance.calculatedAt,
        }
      : null,
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

// ========================================
// Performance Calculations
// ========================================

type PBCategory = "best_set_volume" | "best_e1rm" | "most_reps" | "heaviest_weight"

export function calculateSetVolume(weight: number, reps: number, isBodyweight: boolean): number {
  if (isBodyweight && weight === 0) return 0
  return weight * reps
}

export function calculateE1RM(weight: number, reps: number, isBodyweight: boolean): number | null {
  if (isBodyweight && weight === 0) return null
  if (weight <= 0 || reps <= 0) return null
  return Math.round(weight * (1 + reps / 30) * 100) / 100
}

interface ExercisePerformanceResult {
  exerciseId: ObjectId
  exerciseName: string
  isBodyweight: boolean
  totalVolume: number
  totalReps: number
  e1RM: number | null
  bestSetVolume: number
  heaviestWeight: number
  mostRepsInSet: number
}

export function calculateExercisePerformance(
  sets: any[],
  exercise: { exerciseId: ObjectId; exerciseName: string; equipment: string },
): ExercisePerformanceResult {
  const isBodyweight = exercise.equipment === "bodyweight"
  let totalVolume = 0
  let totalReps = 0
  let bestE1RM: number | null = null
  let bestSetVolume = 0
  let heaviestWeight = 0
  let mostRepsInSet = 0

  for (const set of sets) {
    const w = set.weight ?? 0
    const r = set.reps ?? 0
    const sv = calculateSetVolume(w, r, isBodyweight)
    totalVolume += sv
    totalReps += r

    if (sv > bestSetVolume) bestSetVolume = sv
    if (w > heaviestWeight) heaviestWeight = w
    if (r > mostRepsInSet) mostRepsInSet = r

    const e1rm = calculateE1RM(w, r, isBodyweight)
    if (e1rm !== null && (bestE1RM === null || e1rm > bestE1RM)) {
      bestE1RM = e1rm
    }
  }

  return {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    isBodyweight,
    totalVolume,
    totalReps,
    e1RM: bestE1RM,
    bestSetVolume,
    heaviestWeight,
    mostRepsInSet,
  }
}

export function checkPersonalBests(
  perf: ExercisePerformanceResult,
  currentPBs: any,
): PBCategory[] {
  const beaten: PBCategory[] = []
  const pbs = currentPBs ?? {}

  if (!perf.isBodyweight) {
    if (perf.bestSetVolume > 0 && (pbs.bestSetVolume == null || perf.bestSetVolume > pbs.bestSetVolume.value)) {
      beaten.push("best_set_volume")
    }
    if (perf.e1RM != null && (pbs.bestE1RM == null || perf.e1RM > pbs.bestE1RM.value)) {
      beaten.push("best_e1rm")
    }
    if (perf.heaviestWeight > 0 && (pbs.heaviestWeight == null || perf.heaviestWeight > pbs.heaviestWeight.value)) {
      beaten.push("heaviest_weight")
    }
  }

  if (perf.mostRepsInSet > 0 && (pbs.mostReps == null || perf.mostRepsInSet > pbs.mostReps.value)) {
    beaten.push("most_reps")
  }

  return beaten
}

export async function calculateAndStorePerformance(
  logDoc: WithId<Document>,
  userId: ObjectId,
): Promise<any> {
  const exercises = await getExercisesCollection()
  const logs = await getWorkoutLogsCollection()
  const now = new Date()

  const snapshotExercises = logDoc.planSnapshot?.exercises ?? []
  const sets = logDoc.sets ?? []

  // Build a map of exerciseId -> exercise info from snapshot
  const exerciseMap = new Map<string, any>()
  for (const e of snapshotExercises) {
    exerciseMap.set(e.exerciseId.toString(), e)
  }

  // For additional exercises not in snapshot, look them up
  const setExerciseIds = Array.from(new Set<string>(sets.map((s: any) => s.exerciseId.toString())))
  const missingIds = setExerciseIds.filter(id => !exerciseMap.has(id))
  if (missingIds.length > 0) {
    const missingDocs = await exercises
      .find({ _id: { $in: missingIds.map(id => new ObjectId(id)) } })
      .toArray()
    for (const doc of missingDocs) {
      exerciseMap.set(doc._id.toString(), {
        exerciseId: doc._id,
        exerciseName: doc.name,
        equipment: doc.equipment ?? "bodyweight",
      })
    }
  }

  // Group sets by exerciseId
  const setsByExercise = new Map<string, any[]>()
  for (const set of sets) {
    const eid = set.exerciseId.toString()
    if (!setsByExercise.has(eid)) setsByExercise.set(eid, [])
    setsByExercise.get(eid)!.push(set)
  }

  // Load current PBs for all exercises in this session
  const allExerciseIds = [...setsByExercise.keys()]
  const exerciseDocs = await exercises
    .find({ _id: { $in: allExerciseIds.map(id => new ObjectId(id)) } })
    .toArray()
  const exercisePBMap = new Map(exerciseDocs.map(d => [d._id.toString(), d.personalBests ?? {}]))

  // Calculate per-exercise performance
  let sessionTotalVolume = 0
  let sessionTotalReps = 0
  const exercisePerformance: any[] = []

  for (const [eid, exSets] of setsByExercise) {
    const exInfo = exerciseMap.get(eid)
    if (!exInfo) continue

    const perf = calculateExercisePerformance(exSets, {
      exerciseId: new ObjectId(eid),
      exerciseName: exInfo.exerciseName ?? exInfo.name ?? "Unknown",
      equipment: exInfo.equipment ?? "bodyweight",
    })

    sessionTotalVolume += perf.totalVolume
    sessionTotalReps += perf.totalReps

    // Check and update personal bests
    const currentPBs = exercisePBMap.get(eid) ?? {}
    const beaten = checkPersonalBests(perf, currentPBs)

    if (beaten.length > 0) {
      const pbUpdates: Record<string, any> = {}
      for (const cat of beaten) {
        if (cat === "best_set_volume") {
          pbUpdates["personalBests.bestSetVolume"] = {
            value: perf.bestSetVolume,
            achievedAt: now,
            workoutLogId: logDoc._id,
          }
        } else if (cat === "best_e1rm") {
          pbUpdates["personalBests.bestE1RM"] = {
            value: perf.e1RM,
            achievedAt: now,
            workoutLogId: logDoc._id,
          }
        } else if (cat === "most_reps") {
          pbUpdates["personalBests.mostReps"] = {
            value: perf.mostRepsInSet,
            achievedAt: now,
            workoutLogId: logDoc._id,
          }
        } else if (cat === "heaviest_weight") {
          pbUpdates["personalBests.heaviestWeight"] = {
            value: perf.heaviestWeight,
            achievedAt: now,
            workoutLogId: logDoc._id,
          }
        }
      }
      await exercises.updateOne({ _id: new ObjectId(eid) }, { $set: pbUpdates })
    }

    exercisePerformance.push({
      exerciseId: new ObjectId(eid),
      exerciseName: perf.exerciseName,
      isBodyweight: perf.isBodyweight,
      totalVolume: perf.totalVolume,
      totalReps: perf.totalReps,
      e1RM: perf.e1RM,
      personalBests: beaten,
    })
  }

  const performance = {
    totalVolume: sessionTotalVolume,
    totalReps: sessionTotalReps,
    exercisePerformance,
    calculatedAt: now,
  }

  // Write performance to the workout log
  await logs.updateOne(
    { _id: logDoc._id },
    { $set: { performance, updatedAt: now } },
  )

  return performance
}
