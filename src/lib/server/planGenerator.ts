import Anthropic from "@anthropic-ai/sdk"
import { dev } from "$app/environment"
import { ObjectId, type Document, type WithId } from "mongodb"
import { getUsersCollection } from "./collections"
import { ALL_MUSCLES, REGION_BY_MUSCLE, VALID_EQUIPMENT, loadExerciseNameIndex } from "./dojo"
import { getActiveJourney } from "./journeys"
import { ageFrom, htmlToText, modelParams, resolveTrainerSettings } from "./trainer"
import { DEFAULT_TRAINER_MODEL, type TrainerModel } from "$lib/trainer"
import type { DraftExercise, DraftMessage, DraftSession, Equipment, Muscle, PlanDraft } from "$lib/planDraft"

export class PlanGeneratorError extends Error {}

const SYSTEM_PROMPT = `You are an evidence-based strength & conditioning coach inside Kenko, a wellness app. You design workout plans for the user from their exercise library.

Output rules:
- Always return exactly ONE plan. The number of sessions (training days) comes from the user's request; if they don't say, pick what fits their goal and schedule.
- Strongly prefer exercises from the user's library. Reference a library exercise by putting its id in "libraryExerciseId" and copying its exact name, muscle and equipment.
- Only recommend an exercise that is NOT in the library when it is clearly better for the goal or the library has nothing suitable. For those, set "libraryExerciseId" to null and give a standard, specific name plus its primary muscle and equipment from the allowed values. Don't invent near-duplicates of library exercises.
- "muscle" is the single primary muscle the exercise is filed under.
- targetDayOfWeek is 0–6 (0 = Sunday) only when the user asks for specific days; otherwise null.
- Give every exercise a short "note" saying why it's there (e.g. "compound hinge: posterior chain + grip").
- "summary" is concise markdown: the plan's logic, how sessions are balanced, and how to progress (a concrete progressive-overload rule).

Programming principles:
- For full-body requests, build each session around compound movements that train several muscle groups at once (squats, deadlifts and hinges, presses, rows and pull-ups, lunges, carries). The library only files each exercise under one primary muscle, so use your own knowledge to judge which movements are truly full-body or compound.
- Balance movement patterns across the week: squat, hinge, horizontal push, horizontal pull, vertical push, vertical pull, single-leg, carry, core. Vary the main lift per session (e.g. squat focus / hinge focus / single-leg focus) so the same pattern isn't loaded heavily on consecutive days.
- Order exercises with the most demanding compound lifts first and accessories or core last.
- Sets, reps and rest must match the goal (strength: lower reps, longer rest; hypertrophy: 6–12 reps; endurance: higher reps, shorter rest). Keep session length realistic, usually 5–7 exercises unless asked otherwise.
- Respect the user's equipment, time, experience and any limitations they mention.

Revisions:
- When the user asks for changes, the latest assistant message is the current draft and may include edits the user made by hand. Keep everything they didn't ask to change, apply the requested changes, and return the full updated plan.

Tone: direct and prescriptive. No flattery or pep talk.`

const NULLABLE_STRING = { anyOf: [{ type: "string" }, { type: "null" }] }

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "sessions"],
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    sessions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "targetDayOfWeek", "exercises"],
        properties: {
          name: { type: "string" },
          targetDayOfWeek: { anyOf: [{ type: "integer" }, { type: "null" }] },
          exercises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["libraryExerciseId", "name", "muscle", "equipment", "targetSets", "targetReps", "restSeconds", "note"],
              properties: {
                libraryExerciseId: NULLABLE_STRING,
                name: { type: "string" },
                muscle: { type: "string", enum: ALL_MUSCLES },
                equipment: { type: "string", enum: VALID_EQUIPMENT },
                targetSets: { type: "integer" },
                targetReps: { type: "integer" },
                restSeconds: { type: "integer" },
                note: NULLABLE_STRING,
              },
            },
          },
        },
      },
    },
  },
}

// ── Context ──

interface ExerciseLibrary {
  byId: Map<string, WithId<Document>>
  byName: Map<string, WithId<Document>>
}

async function loadLibrary(userId: ObjectId): Promise<ExerciseLibrary> {
  const byName = await loadExerciseNameIndex(userId)
  const byId = new Map([...byName.values()].map((d) => [d._id.toString(), d]))
  return { byId, byName }
}

async function buildContext(userId: ObjectId, library: ExerciseLibrary, journey: WithId<Document> | null): Promise<string> {
  const users = await getUsersCollection()
  const user = await users.findOne({ _id: userId }, { projection: { profile: 1 } })
  const profile = user?.profile ?? {}

  const athlete = {
    firstName: profile.firstName ?? null,
    age: ageFrom(profile.birthDate, new Date()),
    sex: profile.sex ?? null,
    heightIn: profile.height ?? null,
    weightLbs: profile.weight ?? null,
    activityLevel: profile.activityLevel ?? null,
    journey: journey
      ? {
          name: journey.name,
          whyThisJourneyMatters: htmlToText(journey.statement),
          workoutSessionsPerWeekTarget: journey.dojoTargets?.sessionsPerWeek ?? null,
        }
      : null,
  }

  const lines = [...library.byId.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => `${d._id.toString()} | ${d.name} | ${d.muscleGroup?.muscle ?? "chest"} | ${d.equipment ?? "bodyweight"}`)

  return [
    "## Athlete",
    "```json",
    JSON.stringify(athlete, null, 2),
    "```",
    "",
    `## Exercise library (${lines.length} exercises)`,
    "id | name | primary muscle | equipment",
    ...lines,
  ].join("\n")
}

// ── Normalization ──

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

function isMuscle(value: unknown): value is Muscle {
  return ALL_MUSCLES.includes(value as Muscle)
}

function isEquipment(value: unknown): value is Equipment {
  return VALID_EQUIPMENT.includes(value as Equipment)
}

/**
 * Turns a raw draft (from the model, or edited by the user) into a clean PlanDraft.
 * Library exercises are re-linked by id or name; anything else is flagged as new.
 */
function normalizeDraft(raw: any, library: ExerciseLibrary): PlanDraft {
  const sessions: DraftSession[] = []
  for (const s of Array.isArray(raw?.sessions) ? raw.sessions : []) {
    const exercises: DraftExercise[] = []
    for (const e of Array.isArray(s?.exercises) ? s.exercises : []) {
      const name = typeof e?.name === "string" ? e.name.trim().slice(0, 120) : ""
      const id = e?.libraryExerciseId ?? e?.exerciseId
      const match = (typeof id === "string" && library.byId.get(id)) || (name && library.byName.get(name.toLowerCase())) || null
      const targets = {
        targetSets: clampInt(e?.targetSets, 1, 10, 3),
        targetReps: clampInt(e?.targetReps, 1, 50, 10),
        restSeconds: clampInt(e?.restSeconds, 0, 600, 90),
        note: typeof e?.note === "string" && e.note.trim() ? e.note.trim().slice(0, 300) : null,
      }

      if (match) {
        const muscle: Muscle = isMuscle(match.muscleGroup?.muscle) ? match.muscleGroup.muscle : "chest"
        exercises.push({
          exerciseId: match._id.toString(),
          name: match.name,
          muscle,
          region: REGION_BY_MUSCLE[muscle],
          equipment: isEquipment(match.equipment) ? match.equipment : "bodyweight",
          isNew: false,
          ...targets,
        })
      } else if (name) {
        const muscle: Muscle = isMuscle(e?.muscle) ? e.muscle : "chest"
        exercises.push({
          exerciseId: null,
          name,
          muscle,
          region: REGION_BY_MUSCLE[muscle],
          equipment: isEquipment(e?.equipment) ? e.equipment : "other",
          isNew: true,
          ...targets,
        })
      }
    }
    if (exercises.length === 0) continue

    const day = s?.targetDayOfWeek
    sessions.push({
      name: typeof s?.name === "string" && s.name.trim() ? s.name.trim().slice(0, 80) : `Day ${sessions.length + 1}`,
      targetDayOfWeek: Number.isInteger(day) && day >= 0 && day <= 6 ? day : null,
      exercises,
    })
  }

  return {
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : "AI Plan",
    summary: typeof raw?.summary === "string" ? raw.summary.trim() : "",
    sessions,
  }
}

/** Re-validates a client-submitted draft against the user's current library before it's applied. */
export async function normalizeDraftForUser(userId: ObjectId, raw: unknown): Promise<PlanDraft> {
  return normalizeDraft(raw, await loadLibrary(userId))
}

// ── Claude call ──

/** Validates the client's conversation: starts and ends with a user turn and alternates roles. */
export function parseDraftMessages(input: unknown, maxUserTurns: number, maxLength: number): DraftMessage[] {
  if (!Array.isArray(input) || input.length === 0) throw new PlanGeneratorError("Describe the plan you want.")
  const messages: DraftMessage[] = input.map((m: any, i) => {
    const role = i % 2 === 0 ? "user" : "assistant"
    if (m?.role !== role || typeof m.content !== "string" || !m.content.trim()) {
      throw new PlanGeneratorError("Invalid conversation.")
    }
    if (role === "user" && m.content.length > maxLength) {
      throw new PlanGeneratorError(`Requests must be ${maxLength} characters or fewer.`)
    }
    return { role, content: m.content.trim() }
  })
  if (messages.at(-1)!.role !== "user") throw new PlanGeneratorError("Invalid conversation.")
  if (messages.filter((m) => m.role === "user").length > maxUserTurns) {
    throw new PlanGeneratorError("This draft has reached its revision limit. Apply it and fine-tune in the plan editor, or start over.")
  }
  return messages
}

export async function generatePlanDraft(userId: ObjectId, apiKey: string, messages: DraftMessage[]): Promise<PlanDraft> {
  const journey = await getActiveJourney(userId)
  const model: TrainerModel = journey ? resolveTrainerSettings(journey).model : DEFAULT_TRAINER_MODEL
  const library = await loadLibrary(userId)
  const context = await buildContext(userId, library, journey)

  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 16000,
    system: [
      { type: "text", text: SYSTEM_PROMPT },
      // The library is the bulk of the prompt; cache it so revisions re-read it cheaply
      { type: "text", text: context, cache_control: { type: "ephemeral" } },
    ],
    messages,
    ...modelParams(model, "medium", { type: "json_schema", schema: PLAN_SCHEMA }),
  }

  const final = await new Anthropic({ apiKey }).beta.messages.create(params)

  if (dev) {
    const u = final.usage
    console.log(
      `[plan-generator] ${final.model} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
    )
  }

  if (final.stop_reason === "refusal") throw new PlanGeneratorError("The trainer declined that request. Try rephrasing it.")
  if (final.stop_reason === "max_tokens") throw new PlanGeneratorError("The plan was too long to generate. Ask for fewer sessions or exercises.")

  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new PlanGeneratorError("The trainer returned an unreadable plan. Please try again.")
  }

  const draft = normalizeDraft(raw, library)
  if (draft.sessions.length === 0) throw new PlanGeneratorError("The trainer didn't return any sessions. Try a more specific request.")
  return draft
}
