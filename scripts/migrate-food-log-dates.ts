/**
 * Migration: Re-align foodItemLog.date from UTC midnight to start-of-day
 * in each user's timezone.
 *
 * Usage: npx tsx scripts/migrate-food-log-dates.ts
 *
 * Before this fix, food item logs stored `date` as `YYYY-MM-DDT00:00:00.000Z`
 * (UTC midnight). The overview dashboard queries using timezone-aware day
 * boundaries, so records in timezones west of UTC were not found.
 *
 * This script:
 * 1. Reads each user's timezone from their profile.
 * 2. For each food item log, extracts the calendar date the UTC midnight
 *    value represents and converts it to start-of-day in the user's timezone.
 */

import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

function getOffsetMs(date: Date, tz: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" })
  const tzStr = date.toLocaleString("en-US", { timeZone: tz })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

function startOfDayTz(dateStr: string, tz: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const guessUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  const offset = getOffsetMs(guessUtc, tz)
  const candidate = new Date(guessUtc.getTime() - offset)
  const offset2 = getOffsetMs(candidate, tz)
  if (offset !== offset2) {
    return new Date(guessUtc.getTime() - offset2)
  }
  return candidate
}

async function migrate() {
  const client = new MongoClient(uri!)
  await client.connect()
  const db = client.db()

  // Build userId -> timezone map
  const users = await db.collection("users").find({}).toArray()
  const tzMap = new Map<string, string>()
  for (const user of users) {
    const tz = user.profile?.timezone ?? "America/Los_Angeles"
    tzMap.set(user._id.toString(), tz)
  }
  console.log(`Found ${tzMap.size} users`)

  const foodItemLogs = db.collection("foodItemLogs")
  const allLogs = await foodItemLogs.find({}).toArray()
  console.log(`Found ${allLogs.length} food item logs to check`)

  let updated = 0
  for (const log of allLogs) {
    const tz = tzMap.get(log.userId.toString()) ?? "America/Los_Angeles"
    const oldDate = log.date instanceof Date ? log.date : new Date(log.date)

    // Extract the calendar date from the stored UTC value
    const calendarDate = oldDate.toISOString().split("T")[0]

    // Compute what start-of-day should be in the user's timezone
    const correctDate = startOfDayTz(calendarDate, tz)

    // Only update if different
    if (oldDate.getTime() !== correctDate.getTime()) {
      await foodItemLogs.updateOne(
        { _id: log._id },
        { $set: { date: correctDate, updatedAt: new Date() } },
      )
      updated++
    }
  }

  console.log(`Updated ${updated} food item logs`)
  await client.close()
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
