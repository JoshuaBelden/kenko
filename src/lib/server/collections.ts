import { getDb } from "./db"

export async function getUsersCollection() {
  const db = await getDb()
  return db.collection("users")
}

export async function getSessionsCollection() {
  const db = await getDb()
  return db.collection("sessions")
}
