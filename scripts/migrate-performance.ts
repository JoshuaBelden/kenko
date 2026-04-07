/**
 * Migration: Backfill performance data on completed workout logs and
 * personal bests on exercises.
 *
 * Usage: npx tsx scripts/migrate-performance.ts
 *
 * Iterates all completed workout logs chronologically, calculates
 * performance metrics (volume, e1RM, reps), and updates exercise
 * personal bests. Processes in chronological order so PBs reflect
 * the correct "first achieved" timestamps.
 */

import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

function calculateSetVolume(weight: number, reps: number, isBodyweight: boolean): number {
  if (isBodyweight && weight === 0) return 0
  return weight * reps
}

function calculateE1RM(weight: number, reps: number, isBodyweight: boolean): number | null {
  if (isBodyweight && weight === 0) return null
  if (weight <= 0 || reps <= 0) return null
  return Math.round(weight * (1 + reps / 30) * 100) / 100
}

async function migrate() {
  const client = new MongoClient(uri!)
  await client.connect()
  const db = client.db("kenko")

  const logs = db.collection("workoutLogs")
  const exercises = db.collection("exercises")

  // Reset all exercise personal bests first
  await exercises.updateMany({}, { $unset: { personalBests: "" } })
  console.log("Cleared existing personal bests on exercises")

  // Process completed strength logs chronologically
  const cursor = logs.find({
    status: "completed",
    "planSnapshot.sessionType": { $ne: "cardio" },
    "sets.0": { $exists: true },
  }).sort({ completedAt: 1 })

  // Cache exercise equipment info
  const equipmentCache = new Map<string, string>()
  async function getEquipment(exerciseId: string): Promise<string> {
    if (equipmentCache.has(exerciseId)) return equipmentCache.get(exerciseId)!
    const ex = await exercises.findOne({ _id: new ObjectId(exerciseId) })
    const eq = ex?.equipment ?? "bodyweight"
    equipmentCache.set(exerciseId, eq)
    return eq
  }

  // Track running PBs per exercise
  const currentPBs = new Map<string, any>()

  let updated = 0
  for await (const log of cursor) {
    const snapshotExercises = log.planSnapshot?.exercises ?? []
    const sets = log.sets ?? []
    const now = log.completedAt ?? log.updatedAt ?? new Date()

    // Build exercise info map from snapshot
    const exerciseMap = new Map<string, any>()
    for (const e of snapshotExercises) {
      exerciseMap.set(e.exerciseId.toString(), e)
    }

    // Look up missing exercises (additional ones)
    const setExerciseIds = [...new Set(sets.map((s: any) => s.exerciseId.toString()))]
    for (const eid of setExerciseIds) {
      if (!exerciseMap.has(eid)) {
        const eq = await getEquipment(eid)
        const ex = await exercises.findOne({ _id: new ObjectId(eid) })
        exerciseMap.set(eid, {
          exerciseId: new ObjectId(eid),
          exerciseName: ex?.name ?? "Unknown",
          equipment: eq,
        })
      }
    }

    // Group sets by exercise
    const setsByExercise = new Map<string, any[]>()
    for (const set of sets) {
      const eid = set.exerciseId.toString()
      if (!setsByExercise.has(eid)) setsByExercise.set(eid, [])
      setsByExercise.get(eid)!.push(set)
    }

    let sessionTotalVolume = 0
    let sessionTotalReps = 0
    const exercisePerformance: any[] = []

    for (const [eid, exSets] of setsByExercise) {
      const exInfo = exerciseMap.get(eid)
      if (!exInfo) continue

      const isBodyweight = (exInfo.equipment ?? "bodyweight") === "bodyweight"

      let totalVolume = 0
      let totalReps = 0
      let bestE1RM: number | null = null
      let bestSetVolume = 0
      let heaviestWeight = 0
      let mostRepsInSet = 0

      for (const set of exSets) {
        const w = set.weight ?? 0
        const r = set.reps ?? 0
        const sv = calculateSetVolume(w, r, isBodyweight)
        totalVolume += sv
        totalReps += r
        if (sv > bestSetVolume) bestSetVolume = sv
        if (w > heaviestWeight) heaviestWeight = w
        if (r > mostRepsInSet) mostRepsInSet = r
        const e1rm = calculateE1RM(w, r, isBodyweight)
        if (e1rm !== null && (bestE1RM === null || e1rm > bestE1RM)) bestE1RM = e1rm
      }

      sessionTotalVolume += totalVolume
      sessionTotalReps += totalReps

      // Check PBs against running state
      const pbs = currentPBs.get(eid) ?? {}
      const beaten: string[] = []

      if (!isBodyweight) {
        if (bestSetVolume > 0 && (pbs.bestSetVolume == null || bestSetVolume > pbs.bestSetVolume.value)) {
          beaten.push("best_set_volume")
          pbs.bestSetVolume = { value: bestSetVolume, achievedAt: now, workoutLogId: log._id }
        }
        if (bestE1RM != null && (pbs.bestE1RM == null || bestE1RM > pbs.bestE1RM.value)) {
          beaten.push("best_e1rm")
          pbs.bestE1RM = { value: bestE1RM, achievedAt: now, workoutLogId: log._id }
        }
        if (heaviestWeight > 0 && (pbs.heaviestWeight == null || heaviestWeight > pbs.heaviestWeight.value)) {
          beaten.push("heaviest_weight")
          pbs.heaviestWeight = { value: heaviestWeight, achievedAt: now, workoutLogId: log._id }
        }
      }
      if (mostRepsInSet > 0 && (pbs.mostReps == null || mostRepsInSet > pbs.mostReps.value)) {
        beaten.push("most_reps")
        pbs.mostReps = { value: mostRepsInSet, achievedAt: now, workoutLogId: log._id }
      }

      currentPBs.set(eid, pbs)

      exercisePerformance.push({
        exerciseId: new ObjectId(eid),
        exerciseName: exInfo.exerciseName ?? exInfo.name ?? "Unknown",
        isBodyweight,
        totalVolume,
        totalReps,
        e1RM: bestE1RM,
        personalBests: beaten,
      })
    }

    const performance = {
      totalVolume: sessionTotalVolume,
      totalReps: sessionTotalReps,
      exercisePerformance,
      calculatedAt: now,
    }

    await logs.updateOne({ _id: log._id }, { $set: { performance } })
    updated++

    if (updated % 50 === 0) console.log(`  processed ${updated} logs...`)
  }

  // Write final PBs to exercise documents
  let pbsWritten = 0
  for (const [eid, pbs] of currentPBs) {
    const pbDoc: any = {}
    if (pbs.bestSetVolume) pbDoc.bestSetVolume = pbs.bestSetVolume
    if (pbs.bestE1RM) pbDoc.bestE1RM = pbs.bestE1RM
    if (pbs.mostReps) pbDoc.mostReps = pbs.mostReps
    if (pbs.heaviestWeight) pbDoc.heaviestWeight = pbs.heaviestWeight

    if (Object.keys(pbDoc).length > 0) {
      await exercises.updateOne(
        { _id: new ObjectId(eid) },
        { $set: { personalBests: pbDoc } },
      )
      pbsWritten++
    }
  }

  console.log(`Updated performance on ${updated} workout logs`)
  console.log(`Wrote personal bests for ${pbsWritten} exercises`)
  await client.close()
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
