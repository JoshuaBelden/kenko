import type { Document, ObjectId, WithId } from "mongodb"
import { getJourneysCollection } from "./collections"
import {
  DEFAULT_KICKOFF_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TRAINER_MODEL,
  TRAINER_PROMPT_MAX_LENGTH,
  isTrainerModel,
} from "$lib/trainer"
import {
  DEFAULT_WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL_MAX_LENGTH,
  WORKOUT_TYPES_MAX_COUNT,
  isWorkoutTypeKey,
  workoutTypeKey,
  type WorkoutType,
} from "$lib/workoutTypes"

export async function createDefaultJourney(userId: ObjectId, tz: string = "America/Los_Angeles"): Promise<void> {
  const journeys = await getJourneysCollection()
  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)

  await journeys.insertOne({
    userId,
    name: "New Me",
    description: "Your first year of wellness",
    startDate: now,
    endDate: oneYearLater,
    status: "active",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  })
}

export function serializeJourney(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    description: doc.description ?? "",
    statement: doc.statement ?? null,
    startDate: doc.startDate instanceof Date ? doc.startDate.toISOString() : doc.startDate,
    endDate: doc.endDate instanceof Date ? doc.endDate.toISOString() : doc.endDate,
    status: doc.status,
    isDefault: doc.isDefault ?? false,
    shokuTargets: doc.shokuTargets ?? null,
    danjikiTargets: doc.danjikiTargets ?? null,
    dojoTargets: doc.dojoTargets
      ? {
          planIds: (doc.dojoTargets.planIds ?? []).map((id: any) => id.toString()),
          sessionsPerWeek: doc.dojoTargets.sessionsPerWeek ?? null,
          weeklyCalorieBurn: doc.dojoTargets.weeklyCalorieBurn ?? null,
        }
      : null,
    workoutTypes: serializeWorkoutTypes(doc.workoutTypes),
    kataTargets: doc.kataTargets
      ? {
          commitmentIds: (doc.kataTargets.commitmentIds ?? []).map((id: any) => id.toString()),
        }
      : null,
    trainerSettings: doc.trainerSettings
      ? {
          model: doc.trainerSettings.model ?? DEFAULT_TRAINER_MODEL,
          systemPrompt: doc.trainerSettings.systemPrompt ?? null,
          kickoffPrompt: doc.trainerSettings.kickoffPrompt ?? null,
        }
      : null,
    shokuMealPlan: doc.shokuMealPlan
      ? {
          items: (doc.shokuMealPlan.items ?? []).map((item: any) => ({
            foodItemId: item.foodItemId?.toString() ?? item.foodItemId,
            macroType: item.macroType,
          })),
        }
      : null,
    shokuMealBuilds: (doc.shokuMealBuilds ?? []).map((build: any) => ({
      id: build._id?.toString() ?? build.id,
      name: build.name,
      meals: {
        breakfast: (build.meals?.breakfast ?? []).map((item: any) => ({
          foodItemId: item.foodItemId?.toString() ?? item.foodItemId,
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
        lunch: (build.meals?.lunch ?? []).map((item: any) => ({
          foodItemId: item.foodItemId?.toString() ?? item.foodItemId,
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
        dinner: (build.meals?.dinner ?? []).map((item: any) => ({
          foodItemId: item.foodItemId?.toString() ?? item.foodItemId,
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
        snack: (build.meals?.snack ?? []).map((item: any) => ({
          foodItemId: item.foodItemId?.toString() ?? item.foodItemId,
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
      },
      createdAt: build.createdAt instanceof Date ? build.createdAt.toISOString() : build.createdAt,
      updatedAt: build.updatedAt instanceof Date ? build.updatedAt.toISOString() : build.updatedAt,
    })),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

function serializeWorkoutTypes(value: unknown): WorkoutType[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_WORKOUT_TYPES
  return value.map((t: any) => ({ key: t.key, label: t.label }))
}

/** The journey that drives the dojo: the most recently started active journey covering now. */
export async function getActiveJourney(userId: ObjectId) {
  const journeys = await getJourneysCollection()
  const now = new Date()
  return journeys.findOne(
    { userId, status: "active", startDate: { $lte: now }, endDate: { $gte: now } },
    { sort: { startDate: -1 } },
  )
}

export async function getWorkoutTypesForUser(userId: ObjectId): Promise<WorkoutType[]> {
  const journey = await getActiveJourney(userId)
  return serializeWorkoutTypes(journey?.workoutTypes)
}

export class JourneyValidationError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw new JourneyValidationError(`${field} must be a number`)
  return n
}

export function parseShokuTargets(input: unknown) {
  if (input === null) return null
  if (!isPlainObject(input)) throw new JourneyValidationError("shokuTargets must be an object")
  const macros = isPlainObject(input.macros) ? input.macros : {}
  const macro = (key: "protein" | "carbs" | "fat") => {
    const m = isPlainObject(macros[key]) ? macros[key] : {}
    return {
      percentage: numberOrNull(m.percentage, `macros.${key}.percentage`),
      grams: numberOrNull(m.grams, `macros.${key}.grams`),
    }
  }
  return {
    weightGoalLbsPerWeek: numberOrNull(input.weightGoalLbsPerWeek, "weightGoalLbsPerWeek"),
    targetWeight: numberOrNull(input.targetWeight, "targetWeight"),
    dailyCalorieTarget: numberOrNull(input.dailyCalorieTarget, "dailyCalorieTarget"),
    dailyCalorieOverride: input.dailyCalorieOverride === true,
    macros: { protein: macro("protein"), carbs: macro("carbs"), fat: macro("fat") },
    dailyWaterTargetOz: numberOrNull(input.dailyWaterTargetOz, "dailyWaterTargetOz"),
  }
}

export function parseDanjikiTargets(input: unknown) {
  if (input === null) return null
  if (!isPlainObject(input)) throw new JourneyValidationError("danjikiTargets must be an object")
  return { weeklyFastingHours: numberOrNull(input.weeklyFastingHours, "weeklyFastingHours") }
}

export function parseWorkoutType(input: unknown): WorkoutType {
  if (!isPlainObject(input)) throw new JourneyValidationError("Workout type must be an object")
  const label = typeof input.label === "string" ? input.label.trim() : ""
  if (!label) throw new JourneyValidationError("Workout type name is required")
  if (label.length > WORKOUT_TYPE_LABEL_MAX_LENGTH) {
    throw new JourneyValidationError(`Workout type names must be ${WORKOUT_TYPE_LABEL_MAX_LENGTH} characters or fewer`)
  }
  // Existing types keep their key so renaming a type doesn't orphan logs that reference it
  const key = isWorkoutTypeKey(input.key) ? input.key : workoutTypeKey(label)
  if (!key) throw new JourneyValidationError("Workout type name must contain letters or numbers")
  return { key, label }
}

export function parseWorkoutTypes(input: unknown): WorkoutType[] | null {
  if (input === null) return null
  if (!Array.isArray(input)) throw new JourneyValidationError("workoutTypes must be an array")
  if (input.length === 0) throw new JourneyValidationError("At least one workout type is required")
  if (input.length > WORKOUT_TYPES_MAX_COUNT) {
    throw new JourneyValidationError(`No more than ${WORKOUT_TYPES_MAX_COUNT} workout types`)
  }
  const parsed = input.map(parseWorkoutType)
  const seen = new Set<string>()
  for (const t of parsed) {
    if (seen.has(t.key)) throw new JourneyValidationError(`Duplicate workout type: ${t.label}`)
    seen.add(t.key)
  }
  return parsed
}

/** Prompts equal to the default (or empty) are stored as null so users keep getting default improvements. */
function parseTrainerPrompt(value: unknown, defaultValue: string, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") throw new JourneyValidationError(`${field} must be a string`)
  const trimmed = value.trim()
  if (trimmed.length > TRAINER_PROMPT_MAX_LENGTH) {
    throw new JourneyValidationError(`${field} must be ${TRAINER_PROMPT_MAX_LENGTH} characters or fewer`)
  }
  if (!trimmed || trimmed === defaultValue.trim()) return null
  return trimmed
}

export function parseTrainerSettings(input: unknown) {
  if (input === null) return null
  if (!isPlainObject(input)) throw new JourneyValidationError("trainerSettings must be an object")
  const model = input.model ?? DEFAULT_TRAINER_MODEL
  if (!isTrainerModel(model)) throw new JourneyValidationError("Unsupported trainer model")
  return {
    model,
    systemPrompt: parseTrainerPrompt(input.systemPrompt, DEFAULT_SYSTEM_PROMPT, "systemPrompt"),
    kickoffPrompt: parseTrainerPrompt(input.kickoffPrompt, DEFAULT_KICKOFF_PROMPT, "kickoffPrompt"),
  }
}
