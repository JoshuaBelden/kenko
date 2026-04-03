import { getExercisesCollection, getWorkoutPlansCollection } from "$lib/server/dojo"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const plans = await getWorkoutPlansCollection()
  const plan = await plans.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!plan) return json({ error: "Not found" }, { status: 404 })

  // Resolve exercise names for portability
  const exerciseIds = (plan.sessions ?? []).flatMap((s: any) =>
    (s.exercises ?? []).map((e: any) => e.exerciseId)
  )

  const exercisesCol = await getExercisesCollection()
  const exerciseDocs = await exercisesCol.find({ _id: { $in: exerciseIds } }).toArray()
  const exerciseMap = new Map(exerciseDocs.map(d => [d._id.toString(), d]))

  const exported = {
    version: 1,
    name: plan.name,
    sessions: (plan.sessions ?? []).map((s: any) => ({
      name: s.name,
      targetDayOfWeek: s.targetDayOfWeek ?? null,
      exercises: (s.exercises ?? []).map((e: any) => {
        const ex = exerciseMap.get(e.exerciseId?.toString())
        return {
          exerciseName: ex?.name ?? "Unknown",
          muscleGroup: ex?.muscleGroup ?? { region: "torso", muscle: "chest" },
          equipment: ex?.equipment ?? "bodyweight",
          order: e.order ?? 0,
          targetSets: e.targetSets ?? 3,
          targetReps: e.targetReps ?? 10,
          targetWeight: e.targetWeight ?? null,
          restSeconds: e.restSeconds ?? 90,
        }
      }),
    })),
    exportedAt: new Date().toISOString(),
  }

  return json(exported)
}
