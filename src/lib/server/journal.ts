import type { Document, WithId } from "mongodb"
import { ObjectId } from "mongodb"
import { getJournalEntriesCollection, getWeightLogCollection, getUsersCollection } from "./collections"
import type { WeatherData } from "./weatherApi"
import { startOfDayTz, endOfDayTz, startOfWeekTz, dayOfWeekTz } from "./dates"
import { getWorkoutLogsCollection, getWorkoutPlansCollection } from "./dojo"
import { getCommitmentsCollection, getCommitmentLogsCollection } from "./kata"
import { getFoodItemLogsCollection } from "./shoku"

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
    weather: null,
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

export async function updateWeather(entryId: ObjectId, userId: ObjectId, weather: WeatherData) {
  const entries = await getJournalEntriesCollection()
  return entries.findOneAndUpdate(
    { _id: entryId, userId },
    { $set: { weather, updatedAt: new Date() } },
    { returnDocument: "after" },
  )
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
    weather: doc.weather ?? null,
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

/**
 * Unfinished business for a journal day: daily habits not yet met, workout sessions targeted
 * for that weekday that haven't been logged this week, and main meals with no food logged.
 * Each module is only checked when the journey has targets configured for it.
 */
export async function getDayCheck(
  userId: ObjectId,
  journey: WithId<Document>,
  date: string,
  userTz: string,
) {
  const dayStart = startOfDayTz(date, userTz)
  const dayEnd = endOfDayTz(date, userTz)

  const result: { habits: string[]; workouts: string[]; meals: string[] } = { habits: [], workouts: [], meals: [] }

  if (journey.kataTargets) {
    const commitmentIds = (journey.kataTargets.commitmentIds ?? []).map((id: any) =>
      id instanceof ObjectId ? id : new ObjectId(id),
    )
    if (commitmentIds.length > 0) {
      const commitments = await (await getCommitmentsCollection())
        .find({ _id: { $in: commitmentIds }, userId, period: "daily", direction: { $ne: "limit" }, type: { $ne: "taper" } })
        .toArray()
      const daily = commitments.filter((c) => !c.startDate || new Date(c.startDate) <= dayEnd)
      const totals = await (await getCommitmentLogsCollection())
        .aggregate([
          { $match: { userId, commitmentId: { $in: daily.map((c) => c._id) }, date: { $gte: dayStart, $lte: dayEnd } } },
          { $group: { _id: "$commitmentId", total: { $sum: "$value" } } },
        ])
        .toArray()
      const totalById = new Map(totals.map((t) => [t._id.toString(), t.total as number]))
      for (const c of daily) {
        const target = c.targetValue || 1
        if ((totalById.get(c._id.toString()) ?? 0) < target) result.habits.push(c.name)
      }
    }
  }

  if (journey.dojoTargets) {
    const planIds = (journey.dojoTargets.planIds ?? []).map((id: any) =>
      id instanceof ObjectId ? id : new ObjectId(id),
    )
    if (planIds.length > 0) {
      const dow = dayOfWeekTz(dayStart, userTz)
      const plans = await (await getWorkoutPlansCollection()).find({ _id: { $in: planIds }, userId }).toArray()
      const weekLogs = await (await getWorkoutLogsCollection())
        .find({
          userId,
          status: "completed",
          planId: { $in: planIds },
          completedAt: { $gte: startOfWeekTz(dayStart, userTz), $lte: dayEnd },
        })
        .toArray()

      // Same rule as the overview: a session logged any day this week (up to this day) counts
      const remaining = new Map<string, number>()
      for (const l of weekLogs) {
        const key = `${l.planId?.toString()}::${l.planSnapshot?.sessionName}`
        remaining.set(key, (remaining.get(key) ?? 0) + 1)
      }
      for (const plan of plans) {
        for (const session of plan.sessions ?? []) {
          const key = `${plan._id.toString()}::${session.name}`
          const left = remaining.get(key) ?? 0
          if (left > 0) {
            remaining.set(key, left - 1)
            continue
          }
          if (session.targetDayOfWeek === dow) result.workouts.push(session.name)
        }
      }
    }
  }

  if (journey.shokuTargets) {
    const logged: string[] = await (await getFoodItemLogsCollection()).distinct("category", {
      userId,
      date: { $gte: dayStart, $lte: dayEnd },
    })
    result.meals = ["breakfast", "lunch", "dinner"].filter((m) => !logged.includes(m))
  }

  return result
}
