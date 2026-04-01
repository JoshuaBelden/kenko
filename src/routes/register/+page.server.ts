import { fail } from "@sveltejs/kit"
import type { Actions } from "./$types"

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData()
    const name = data.get("name") as string
    const email = data.get("email") as string
    const password = data.get("password") as string
    const confirmPassword = data.get("confirmPassword") as string

    if (!name || !email || !password || !confirmPassword) {
      return fail(400, { name, email, missing: true })
    }

    if (password !== confirmPassword) {
      return fail(400, { name, email, mismatch: true })
    }

    // TODO: Create user in MongoDB
    // TODO: Set session cookie
    return fail(501, { name, email, message: "Registration not yet implemented" })
  },
}
