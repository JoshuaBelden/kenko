import { dev } from "$app/environment"
import { SESSION_SECRET } from "$env/static/private"
import type { Cookies } from "@sveltejs/kit"
import bcrypt from "bcryptjs"
import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { ObjectId } from "mongodb"
import { getDb } from "./db"

const COOKIE_NAME = "kenko_session"
const SESSION_MAX_AGE_DAYS = 30
const BCRYPT_ROUNDS = 12

// --- Password hashing ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// --- Sessions ---

function getSessionsCollection() {
  return getDb().then(db => db.collection("sessions"))
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const sessions = await getSessionsCollection()
  await sessions.insertOne({
    token,
    userId: new ObjectId(userId),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
  })
  return token
}

export async function getSessionUserId(token: string): Promise<string | null> {
  const sessions = await getSessionsCollection()
  const session = await sessions.findOne({ token, expiresAt: { $gt: new Date() } })
  if (!session) return null
  return session.userId.toString()
}

export async function deleteSession(token: string): Promise<void> {
  const sessions = await getSessionsCollection()
  await sessions.deleteOne({ token })
}

// --- Cookie helpers ---

function sign(value: string): string {
  const signature = createHmac("sha256", SESSION_SECRET).update(value).digest("hex")
  return `${value}.${signature}`
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf(".")
  if (idx === -1) return null
  const value = signed.slice(0, idx)
  const signature = signed.slice(idx + 1)
  const expected = createHmac("sha256", SESSION_SECRET).update(value).digest("hex")
  const sigBuf = Buffer.from(signature, "hex")
  const expBuf = Buffer.from(expected, "hex")
  if (sigBuf.length !== expBuf.length) return null
  if (!timingSafeEqual(sigBuf, expBuf)) return null
  return value
}

export function setSessionCookie(cookies: Cookies, token: string): void {
  cookies.set(COOKIE_NAME, sign(token), {
    path: "/",
    httpOnly: true,
    secure: !dev,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
  })
}

export function getSessionToken(cookies: Cookies): string | null {
  const cookie = cookies.get(COOKIE_NAME)
  if (!cookie) return null
  return unsign(cookie)
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: "/" })
}

// --- Index setup ---

let indexesEnsured = false

export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return
  indexesEnsured = true
  const db = await getDb()
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("journeys").createIndex({ userId: 1, status: 1, startDate: -1 }),
    db.collection("foodItems").createIndex({ userId: 1 }),
    db.collection("foodItems").createIndex({ userId: 1, name: "text" }),
    db.collection("diaryEntries").createIndex({ userId: 1, date: 1 }),
    db.collection("diaryEntries").createIndex({ journeyIds: 1 }),
  ])
}
