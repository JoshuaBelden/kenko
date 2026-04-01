import { getDb } from "./db"

export async function getUsersCollection() {
  const db = await getDb()
  return db.collection("users")
}

export async function getSessionsCollection() {
  const db = await getDb()
  return db.collection("sessions")
}

export async function getJourneysCollection() {
  const db = await getDb()
  return db.collection("journeys")
}
