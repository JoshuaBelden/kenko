import { createSession, hashPassword, setSessionCookie } from "$lib/server/auth"
import { getUsersCollection } from "$lib/server/collections"
import { createDefaultJourney } from "$lib/server/journeys"
import { fail, redirect } from "@sveltejs/kit"
import type { Actions } from "./$types"

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData()
    const email = (data.get("email") as string)?.trim().toLowerCase()
    const password = data.get("password") as string
    const confirmPassword = data.get("confirmPassword") as string

    if (!email || !password || !confirmPassword) {
      return fail(400, { email, missing: true })
    }

    if (password !== confirmPassword) {
      return fail(400, { email, mismatch: true })
    }

    if (password.length < 8) {
      return fail(400, { email, weak: true })
    }

    const users = await getUsersCollection()
    const existing = await users.findOne({ email })
    if (existing) {
      return fail(400, { email, emailTaken: true })
    }

    const passwordHash = await hashPassword(password)
    const result = await users.insertOne({
      email,
      passwordHash,
      profile: null,
      profileComplete: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    try {
      await createDefaultJourney(result.insertedId)
    } catch {
      // Journey seeding failure must not block registration
    }

    const token = await createSession(result.insertedId.toString())
    setSessionCookie(cookies, token)

    throw redirect(303, "/profile")
  },
}
