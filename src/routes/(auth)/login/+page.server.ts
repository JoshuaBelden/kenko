import { createSession, setSessionCookie, verifyPassword } from "$lib/server/auth"
import { getUsersCollection } from "$lib/server/collections"
import { fail, redirect } from "@sveltejs/kit"
import type { Actions } from "./$types"

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData()
    const email = (data.get("email") as string)?.trim().toLowerCase()
    const password = data.get("password") as string

    if (!email || !password) {
      return fail(400, { email, missing: true })
    }

    const users = await getUsersCollection()
    const user = await users.findOne({ email })

    if (!user) {
      return fail(400, { email, invalid: true })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return fail(400, { email, invalid: true })
    }

    const token = await createSession(user._id.toString())
    setSessionCookie(cookies, token)

    if (!user.profileComplete) {
      throw redirect(303, "/profile")
    }

    throw redirect(303, "/tabi")
  },
}
