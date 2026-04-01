import { MONGODB_URI } from "$env/static/private"
import { dev } from "$app/environment"
import { MongoClient } from "mongodb"

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set")
}

const client = new MongoClient(MONGODB_URI)

let clientPromise: Promise<MongoClient>

if (dev) {
  const globalWithMongo = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  clientPromise = client.connect()
}

export default clientPromise

export async function getDb(dbName = "kenko") {
  const client = await clientPromise
  return client.db(dbName)
}
