import type { Document, WithId } from "mongodb"
import { getDb } from "./db"

// ========================================
// Collections
// ========================================

export async function getFastsCollection() {
  const db = await getDb()
  return db.collection("fasts")
}

// ========================================
// Types
// ========================================

export type FastStatus = "running" | "completed"

export const PRESET_DURATIONS = [12, 16, 18, 20, 24, 36, 48] as const

// ========================================
// Serializers
// ========================================

export function serializeFast(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    journeyIds: (doc.journeyIds ?? []).map((id: any) => id.toString()),
    targetDuration: doc.targetDuration,
    startedAt: doc.startedAt instanceof Date ? doc.startedAt.toISOString() : doc.startedAt,
    endedAt: doc.endedAt instanceof Date ? doc.endedAt.toISOString() : doc.endedAt,
    actualDuration: doc.actualDuration ?? null,
    note: doc.note ?? null,
    status: doc.status,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}
