import type { ObjectId, WithId, Document } from "mongodb"
import { getJourneysCollection } from "./collections"
import { getDb } from "./db"

/** Collection names that carry a journeyIds field. Future modules add theirs here. */
const DATA_COLLECTIONS: string[] = []

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
  const journeys = await getJourneysCollection()
  const docs = await journeys
    .find(
      { userId, status: "active", startDate: { $lte: date }, endDate: { $gte: date } },
      { projection: { _id: 1 } },
    )
    .toArray()
  return docs.map((d) => d._id)
}

export async function removeJourneyFromRecords(journeyId: ObjectId): Promise<void> {
  if (DATA_COLLECTIONS.length === 0) return
  const db = await getDb()
  await Promise.all(
    DATA_COLLECTIONS.map((name) =>
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
    startDate: doc.startDate instanceof Date ? doc.startDate.toISOString() : doc.startDate,
    endDate: doc.endDate instanceof Date ? doc.endDate.toISOString() : doc.endDate,
    status: doc.status,
    isDefault: doc.isDefault ?? false,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}
