import type { Document, WithId } from "mongodb"
import { ObjectId } from "mongodb"
import { getJournalEntriesCollection, getWeightLogCollection, getUsersCollection } from "./collections"

export async function getJournalEntry(userId: ObjectId, journeyId: ObjectId, date: string) {
  const entries = await getJournalEntriesCollection()
  return entries.findOne({ userId, journeyId, date })
}

export async function createJournalEntry(userId: ObjectId, journeyId: ObjectId, date: string) {
  const entries = await getJournalEntriesCollection()
  const now = new Date()
  const doc = {
    userId,
    journeyId,
    date,
    morning: {
      bodyWeight: null,
      sleepDuration: null,
      sleepQuality: null,
      notes: null,
    },
    evening: {
      mood: null,
      energy: null,
      highlights: null,
      challenges: null,
      intention: null,
      dayRating: null,
      notes: null,
    },
    createdAt: now,
    updatedAt: now,
  }
  const result = await entries.insertOne(doc)
  return { ...doc, _id: result.insertedId }
}

export async function updateMorning(entryId: ObjectId, userId: ObjectId, fields: Record<string, any>) {
  const entries = await getJournalEntriesCollection()
  const setFields: Record<string, any> = { updatedAt: new Date() }
  for (const [key, value] of Object.entries(fields)) {
    setFields[`morning.${key}`] = value
  }
  const result = await entries.findOneAndUpdate(
    { _id: entryId, userId },
    { $set: setFields },
    { returnDocument: "after" },
  )
  return result
}

export async function updateEvening(entryId: ObjectId, userId: ObjectId, fields: Record<string, any>) {
  const entries = await getJournalEntriesCollection()
  const setFields: Record<string, any> = { updatedAt: new Date() }
  for (const [key, value] of Object.entries(fields)) {
    setFields[`evening.${key}`] = value
  }
  const result = await entries.findOneAndUpdate(
    { _id: entryId, userId },
    { $set: setFields },
    { returnDocument: "after" },
  )
  return result
}

export async function upsertWeightLog(userId: ObjectId, date: string, weight: number) {
  const weightLog = await getWeightLogCollection()
  const now = new Date()
  await weightLog.updateOne(
    { userId, date },
    {
      $set: { weight, updatedAt: now },
      $setOnInsert: { userId, date, createdAt: now },
    },
    { upsert: true },
  )
}

export async function updateProfileWeight(userId: ObjectId, weight: number) {
  const users = await getUsersCollection()
  await users.updateOne(
    { _id: userId },
    { $set: { "profile.weight": weight, updatedAt: new Date() } },
  )
}

export async function getYesterdayIntention(userId: ObjectId, journeyId: ObjectId, todayDate: string) {
  const d = new Date(todayDate + "T00:00:00")
  d.setDate(d.getDate() - 1)
  const yesterdayDate = d.toISOString().split("T")[0]

  const entries = await getJournalEntriesCollection()
  const entry = await entries.findOne(
    { userId, journeyId, date: yesterdayDate },
    { projection: { "evening.intention": 1 } },
  )
  return entry?.evening?.intention ?? null
}

export async function getWeightLogEntries(userId: ObjectId) {
  const weightLog = await getWeightLogCollection()
  return weightLog.find({ userId }).sort({ date: 1 }).toArray()
}

export function serializeJournalEntry(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    journeyId: doc.journeyId.toString(),
    date: doc.date,
    morning: doc.morning ?? {
      bodyWeight: null,
      sleepDuration: null,
      sleepQuality: null,
      notes: null,
    },
    evening: doc.evening ?? {
      mood: null,
      energy: null,
      highlights: null,
      challenges: null,
      intention: null,
      dayRating: null,
      notes: null,
    },
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}

export function serializeWeightLogEntry(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    weight: doc.weight,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  }
}
