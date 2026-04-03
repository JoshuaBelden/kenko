import type { Document, ObjectId, WithId } from "mongodb"
import { getJourneysCollection } from "./collections"
import { getDb } from "./db"

/** Collection names that carry a journeyIds field. Future modules add theirs here. */
const DATA_COLLECTIONS: string[] = ["diaryEntries", "workoutLogs"]

export async function createDefaultJourney(userId: ObjectId): Promise<void> {
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

export async function getActiveJourneyIds(userId: ObjectId, date: Date): Promise<ObjectId[]> {
  // Compare at day boundaries — a journey that starts on April 1 should include
  // diary entries logged on April 1, regardless of time-of-day the journey was created.
  const endOfDay = new Date(date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)

  const journeys = await getJourneysCollection()
  const docs = await journeys
    .find(
      { userId, status: "active", startDate: { $lte: endOfDay }, endDate: { $gte: startOfDay } },
      { projection: { _id: 1 } },
    )
    .toArray()
  return docs.map(d => d._id)
}

export async function removeJourneyFromRecords(journeyId: ObjectId): Promise<void> {
  if (DATA_COLLECTIONS.length === 0) return
  const db = await getDb()
  await Promise.all(
    DATA_COLLECTIONS.map(name =>
      db.collection(name).updateMany({ journeyIds: journeyId }, { $pull: { journeyIds: journeyId } as any }),
    ),
  )
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
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}
