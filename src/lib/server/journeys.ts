import type { Document, ObjectId, WithId } from "mongodb"
import { getJourneysCollection } from "./collections"

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
