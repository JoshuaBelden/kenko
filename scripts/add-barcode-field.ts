/**
 * Migration: Add barcode field to all existing food items.
 *
 * Usage: npx tsx scripts/add-barcode-field.ts
 *
 * Sets barcode: null on every foodItem document that doesn't already have the field.
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
  try {
    await client.connect()
    const db = client.db()
    const result = await db
      .collection("foodItems")
      .updateMany({ barcode: { $exists: false } }, { $set: { barcode: null } })
    console.log(`Updated ${result.modifiedCount} food items (added barcode: null)`)
  } finally {
    await client.close()
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
