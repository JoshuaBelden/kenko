import { getJourneysCollection } from "$lib/server/collections"
import { serializeJourney } from "$lib/server/journeys"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { Document } from "mongodb"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeys = await getJourneysCollection()
  const journey = await journeys.findOne({
    _id: new ObjectId(params.id),
    userId: new ObjectId(locals.userId),
  })

  if (!journey) return json({ error: "Not found" }, { status: 404 })
  return json(serializeJourney(journey))
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.statement !== undefined) updates.statement = body.statement
  if (body.startDate !== undefined) updates.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) updates.endDate = new Date(body.endDate)
  if (body.status !== undefined) updates.status = body.status
  if (body.shokuTargets !== undefined) updates.shokuTargets = body.shokuTargets
  if (body.danjikiTargets !== undefined) updates.danjikiTargets = body.danjikiTargets
  if (body.dojoTargets !== undefined) {
    updates.dojoTargets = body.dojoTargets
      ? {
          planIds: (body.dojoTargets.planIds ?? []).map((id: string) => new ObjectId(id)),
          sessionsPerWeek: body.dojoTargets.sessionsPerWeek ?? null,
          weeklyCalorieBurn: body.dojoTargets.weeklyCalorieBurn ?? null,
        }
      : null
  }
  if (body.kataTargets !== undefined) {
    updates.kataTargets = body.kataTargets
      ? {
          commitmentIds: (body.kataTargets.commitmentIds ?? []).map((id: string) => new ObjectId(id)),
        }
      : null
  }
  if (body.shokuMealPlan !== undefined) {
    updates.shokuMealPlan = body.shokuMealPlan
      ? {
          items: (body.shokuMealPlan.items ?? []).map((item: any) => ({
            foodItemId: new ObjectId(item.foodItemId),
            macroType: item.macroType,
          })),
        }
      : null
  }
  if (body.shokuMealBuilds !== undefined) {
    updates.shokuMealBuilds = (body.shokuMealBuilds ?? []).map((build: any) => ({
      _id: build.id ? new ObjectId(build.id) : new ObjectId(),
      name: build.name,
      meals: {
        breakfast: (build.meals?.breakfast ?? []).map((item: any) => ({
          foodItemId: new ObjectId(item.foodItemId),
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
        lunch: (build.meals?.lunch ?? []).map((item: any) => ({
          foodItemId: new ObjectId(item.foodItemId),
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
        dinner: (build.meals?.dinner ?? []).map((item: any) => ({
          foodItemId: new ObjectId(item.foodItemId),
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
        snack: (build.meals?.snack ?? []).map((item: any) => ({
          foodItemId: new ObjectId(item.foodItemId),
          servingSize: item.servingSize,
          servingUnit: item.servingUnit,
          macroType: item.macroType,
        })),
      },
      createdAt: build.createdAt ? new Date(build.createdAt) : new Date(),
      updatedAt: new Date(),
    }))
  }

  const journeys = await getJourneysCollection()
  const result = await journeys.findOneAndUpdate(
    { _id: new ObjectId(params.id), userId: new ObjectId(locals.userId) },
    { $set: updates },
    { returnDocument: "after" },
  )

  if (!result) return json({ error: "Not found" }, { status: 404 })
  return json(serializeJourney(result))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const journeyId = new ObjectId(params.id)
  const journeys = await getJourneysCollection()

  const journey = await journeys.findOne({
    _id: journeyId,
    userId: new ObjectId(locals.userId),
  })

  if (!journey) return json({ error: "Not found" }, { status: 404 })

  await journeys.deleteOne({ _id: journeyId })

  return new Response(null, { status: 204 })
}
