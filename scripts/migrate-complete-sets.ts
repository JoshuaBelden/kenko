/**
 * Migration: Mark all sets as completed on finished workout logs.
 *
 * Usage: npx tsx scripts/migrate-complete-sets.ts
 *
 * Before this change, sets had no `completed` field. This script adds
 * `completed: true` to every set in workout logs with status "completed".
 */

import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

async function migrate() {
  const client = new MongoClient(uri!)
  await client.connect()
  const db = client.db("kenko")

  const logs = db.collection("workoutLogs")
  const cursor = logs.find({ status: "completed", "sets.0": { $exists: true } })

  let updated = 0
  for await (const log of cursor) {
    const newSets = log.sets.map((s: any) => ({ ...s, completed: true }))
    await logs.updateOne({ _id: log._id }, { $set: { sets: newSets } })
    updated++
  }

  console.log(`Updated ${updated} workout logs`)
  await client.close()
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
