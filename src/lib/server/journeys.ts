import type { Document, ObjectId, WithId } from "mongodb"
import { getJourneysCollection } from "./collections"
import {
  DEFAULT_KICKOFF_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TRAINER_MODEL,
  TRAINER_PROMPT_MAX_LENGTH,
  isTrainerModel,
} from "$lib/trainer"

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
