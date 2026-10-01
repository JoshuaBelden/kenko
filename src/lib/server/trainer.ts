import Anthropic from "@anthropic-ai/sdk"
import { dev } from "$app/environment"
import { json } from "@sveltejs/kit"
import { ObjectId, type Document, type WithId } from "mongodb"
import { getJournalEntriesCollection, getTrainerChatsCollection, getUsersCollection } from "./collections"
import { dateStrFromDate, getCalendarDays } from "./calendar"
import { startOfDayTz, startOfWeekTz } from "./dates"
import { getJourneyOverview } from "./overview"
import { decryptSecret, encryptSecret } from "./secrets"
import { geocodeZip } from "./weatherApi"
import {
  DEFAULT_KICKOFF_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TRAINER_MODEL,
  isTrainerModel,
  type TrainerModel,
} from "$lib/trainer"

export const MAX_USER_MESSAGES_PER_DAY = 30

// ── Per-user API key (users pay for their own Anthropic usage) ──
// Stored encrypted on the user document as `trainerApiKey`, outside `profile` so it never reaches the client.

export class TrainerKeyError extends Error {}

export async function getTrainerApiKey(userId: ObjectId): Promise<string | null> {
  const users = await getUsersCollection()
  const user = await users.findOne({ _id: userId }, { projection: { trainerApiKey: 1 } })
  return user?.trainerApiKey ? decryptSecret(user.trainerApiKey) : null
}

export async function getTrainerKeyStatus(userId: ObjectId): Promise<{ hasKey: boolean; last4: string | null }> {
  const users = await getUsersCollection()
  const user = await users.findOne({ _id: userId }, { projection: { trainerApiKey: 1 } })
  const readable = user?.trainerApiKey ? decryptSecret(user.trainerApiKey) !== null : false
  return { hasKey: readable, last4: readable ? user!.trainerApiKey.last4 : null }
}

/** Checks the key against the Anthropic API, then stores it encrypted. */
export async function saveTrainerApiKey(userId: ObjectId, apiKey: string): Promise<{ last4: string }> {
  const trimmed = apiKey.trim()
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    throw new TrainerKeyError("That doesn't look like an Anthropic API key. Keys start with \"sk-ant-\".")
  }
  try {
    await new Anthropic({ apiKey: trimmed, maxRetries: 0 }).models.list({ limit: 1 })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new TrainerKeyError("Anthropic rejected that API key. Check that it's active and copied correctly.")
    }
    throw new TrainerKeyError("Couldn't reach Anthropic to verify the key. Please try again.")
  }
  const last4 = trimmed.slice(-4)
  const users = await getUsersCollection()
  await users.updateOne(
    { _id: userId },
    { $set: { trainerApiKey: { ...encryptSecret(trimmed), last4, updatedAt: new Date() }, updatedAt: new Date() } },
  )
  return { last4 }
}

export async function removeTrainerApiKey(userId: ObjectId): Promise<void> {
  const users = await getUsersCollection()
  await users.updateOne({ _id: userId }, { $unset: { trainerApiKey: "" }, $set: { updatedAt: new Date() } })
}

export interface ResolvedTrainerSettings {
  model: TrainerModel
  systemPrompt: string
  kickoffPrompt: string
}

export function resolveTrainerSettings(journey: WithId<Document>): ResolvedTrainerSettings {
  const s = journey.trainerSettings ?? {}
  return {
    model: isTrainerModel(s.model) ? s.model : DEFAULT_TRAINER_MODEL,
    systemPrompt: s.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    kickoffPrompt: s.kickoffPrompt || DEFAULT_KICKOFF_PROMPT,
  }
}

export function serializeTrainerChat(doc: WithId<Document>) {
  return {
    id: doc._id.toString(),
    date: doc.date,
    model: doc.model,
    messages: (doc.messages ?? []).map((m: any) => ({
      role: m.role,
      content: m.content,
      at: m.at instanceof Date ? m.at.toISOString() : m.at,
    })),
  }
}

// ── Context snapshot ──

export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const text = html
    .replace(/<\/(p|li|h[1-6]|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

export function ageFrom(birthDate: unknown, now: Date): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate as string)
  if (isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export function section(title: string, data: unknown): string {
  return `## ${title}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
}

/**
 * Renders everything the Trainer knows about the user's day as a single text block:
 * journey goals, today's dashboard, recent progress, recent journal entries and
 * yesterday's trainer advice. Frozen onto the chat when it starts.
 */
export async function buildTrainerContext(
  userId: ObjectId,
  journey: WithId<Document>,
  tz: string,
  today: string,
): Promise<string> {
  const now = new Date()
  const thisWeekStart = startOfWeekTz(now, tz)
  const lastWeekStart = dateStrFromDate(new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000), tz)
  const yesterday = dateStrFromDate(new Date(startOfDayTz(today, tz).getTime() - 12 * 60 * 60 * 1000), tz)

  const [overview, progress, journalEntries, yesterdayChat, user] = await Promise.all([
    getJourneyOverview(userId, journey, tz, now),
    getCalendarDays(userId, journey, tz, lastWeekStart, today),
    getJournalEntriesCollection().then((col) =>
      col
        .find({ userId, journeyId: journey._id, date: { $gte: lastWeekStart, $lte: today } })
        .sort({ date: 1 })
        .toArray(),
    ),
    getTrainerChatsCollection().then((col) => col.findOne({ userId, journeyId: journey._id, date: yesterday })),
    getUsersCollection().then((col) => col.findOne({ _id: userId })),
  ])

  const profile = user?.profile ?? {}
  // Resolve the ZIP to a place name so the trainer can reason about climate and season; falls back to the ZIP alone
  const place = profile.zipCode ? await geocodeZip(profile.zipCode) : null
  const weight = overview.weight ?? {}
  const weightEntries: { date: string; weight: number }[] = weight.entries ?? []
  const journeyStartDay = dateStrFromDate(new Date(journey.startDate), tz)
  const startingWeight =
    [...weightEntries].reverse().find((e) => e.date <= journeyStartDay) ??
    weightEntries.find((e) => e.date >= journeyStartDay) ??
    null
  delete overview.weight

  // Journal notes are shown in the Journal section, so keep the progress days to the numbers
  const progressDays = Object.fromEntries(
    Object.entries(progress.days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => {
        const { morningNotes, eveningNotes, weather, ...rest } = day
        return [date, { ...rest, weather: weather ? { label: weather.weatherLabel, high: weather.temperatureMax, low: weather.temperatureMin } : null }]
      }),
  )

  const journal = journalEntries.map((e) => ({
    date: e.date,
    morning: {
      bodyWeight: e.morning?.bodyWeight ?? null,
      sleepDuration: e.morning?.sleepDuration ?? null,
      sleepQuality: e.morning?.sleepQuality ?? null,
      notes: htmlToText(e.morning?.notes),
    },
    evening: {
      mood: e.evening?.mood ?? null,
      energy: e.evening?.energy ?? null,
      dayRating: e.evening?.dayRating ?? null,
      highlights: e.evening?.highlights ?? null,
      challenges: e.evening?.challenges ?? null,
      intention: e.evening?.intention ?? null,
      notes: htmlToText(e.evening?.notes),
    },
  }))

  const lastAdvice = [...(yesterdayChat?.messages ?? [])].reverse().find((m: any) => m.role === "assistant")

  const goals = {
    journey: {
      name: journey.name,
      description: journey.description ?? null,
      statement: htmlToText(journey.statement),
      startDate: journeyStartDay,
      endDate: dateStrFromDate(new Date(journey.endDate), tz),
    },
    shoku: journey.shokuTargets ?? "not configured",
    danjiki: journey.danjikiTargets ?? "not configured",
    dojo: journey.dojoTargets
      ? {
          sessionsPerWeek: journey.dojoTargets.sessionsPerWeek ?? null,
          weeklyCalorieBurn: journey.dojoTargets.weeklyCalorieBurn ?? null,
          plans: [...new Set((overview.dojo?.upcomingSessions ?? []).map((s: any) => s.planName))],
        }
      : "not configured",
    kata: journey.kataTargets ? "see commitments in today's dashboard" : "not configured",
  }

  const parts = [
    `# Trainer context for ${today} (timezone ${tz})`,
    "Day-of-week numbers use 0 = Sunday. Weights are in lbs, water in oz, fasting and sleep in hours. Journal ratings are 1–5.",
    section("Profile", {
      firstName: profile.firstName ?? null,
      age: ageFrom(profile.birthDate, now),
      sex: profile.sex ?? null,
      heightIn: profile.height ?? null,
      currentWeight: profile.weight ?? null,
      location: profile.zipCode ? { place: place?.placeName ?? null, zipCode: profile.zipCode } : null,
      activityLevel: profile.activityLevel ?? null,
      tdee: progress.tdee,
    }),
    section("Journey goals", goals),
    section("Today's dashboard", overview),
    section("Weight trend", {
      startingWeight,
      latest: weightEntries.at(-1) ?? null,
      targetWeight: weight.targetWeight ?? null,
      weightGoalLbsPerWeek: weight.weightGoalLbsPerWeek ?? null,
      recentEntries: weightEntries.slice(-14),
    }),
    section(`Progress by day (${lastWeekStart} to ${today})`, progressDays),
    section("Journal entries (last week and this week)", journal),
    lastAdvice ? `## Yesterday's trainer advice\n${lastAdvice.content}` : "## Yesterday's trainer advice\nNone.",
  ]
  return parts.join("\n\n")
}

// ── Claude call ──

export interface TrainerChatState {
  model: TrainerModel
  systemPrompt: string
  kickoffPrompt: string
  contextSnapshot: string
  messages: { role: "user" | "assistant"; content: string }[]
}

export type TrainerEffort = "low" | "medium" | "high"

/** Starts a streaming reply for the chat. The first user turn is the frozen context + kickoff prompt. */
export function streamTrainerReply(chat: TrainerChatState, apiKey: string, effort: TrainerEffort = "medium") {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `${chat.contextSnapshot}\n\n${chat.kickoffPrompt}` },
    ...chat.messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  const params: Anthropic.Beta.MessageCreateParams = {
    model: chat.model,
    max_tokens: 16000,
    system: chat.systemPrompt,
    // Caches the growing conversation so follow-ups re-read the context snapshot at ~10% cost
    cache_control: { type: "ephemeral" },
    messages,
  }

  if (chat.model !== "claude-haiku-4-5") {
    params.output_config = { effort }
  }
  if (chat.model === "claude-opus-5") {
    // If Opus declines a request, the API re-runs it on a fallback model within the same call
    params.betas = ["server-side-fallback-2026-07-01"]
    params.fallbacks = "default"
  }

  return new Anthropic({ apiKey }).beta.messages.stream(params)
}

/**
 * Streams the assistant's reply to the client as plain text, then hands the full reply to `onComplete`
 * for saving. Waits for the first event so auth/rate-limit/config errors return a proper status
 * instead of a broken stream.
 */
export async function streamTrainerResponse(
  chat: TrainerChatState,
  apiKey: string,
  onComplete: (reply: string) => Promise<void>,
  options: { effort?: TrainerEffort; logTag?: string } = {},
): Promise<Response> {
  const tag = options.logTag ?? "trainer"
  let stream: ReturnType<typeof streamTrainerReply>
  let iterator: AsyncIterator<Anthropic.Beta.BetaRawMessageStreamEvent>
  let first: IteratorResult<Anthropic.Beta.BetaRawMessageStreamEvent>
  try {
    stream = streamTrainerReply(chat, apiKey, options.effort)
    iterator = stream[Symbol.asyncIterator]()
    first = await iterator.next()
  } catch (err) {
    return trainerErrorResponse(err, tag)
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let event = first
        while (!event.done) {
          const e = event.value
          if (e.type === "content_block_delta" && e.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(e.delta.text))
          }
          event = await iterator.next()
        }

        const final = await stream.finalMessage()
        let reply = final.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")

        if (final.stop_reason === "refusal") {
          const note = "I'm not able to help with that one. Let's get back to your journey — what else can I help you with?"
          const suffix = reply ? `\n\n${note}` : note
          reply += suffix
          controller.enqueue(encoder.encode(suffix))
        } else if (final.stop_reason === "max_tokens") {
          reply += "…"
          controller.enqueue(encoder.encode("…"))
        }

        if (dev) {
          const u = final.usage
          console.log(
            `[${tag}] ${final.model} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
          )
        }

        await onComplete(reply)
        controller.close()
      } catch (err) {
        console.error(`[${tag}] stream failed`, err)
        controller.error(err)
      }
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export function trainerErrorResponse(err: unknown, tag = "trainer") {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return json(
      { error: "Anthropic rejected your API key. Update it in Journey Settings → Trainer." },
      { status: 403 },
    )
  }
  if (err instanceof Anthropic.RateLimitError) {
    return json(
      { error: "Your Anthropic account hit a rate or spend limit. Try again in a minute, or check your Anthropic Console billing." },
      { status: 429 },
    )
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`[${tag}] API error ${err.status}`, err.message)
    return json({ error: "The trainer couldn't respond. Please try again." }, { status: 502 })
  }
  console.error(`[${tag}] unexpected error`, err)
  return json({ error: "The trainer couldn't respond. Please try again." }, { status: 500 })
}
