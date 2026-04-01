import { fail } from "@sveltejs/kit"
import type { Actions } from "./$types"

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData()
    const email = data.get("email") as string
    const password = data.get("password") as string

    if (!email || !password) {
      return fail(400, { email, missing: true })
    }

    // TODO: Authenticate against MongoDB
    // TODO: Set session cookie
    return fail(501, { email, message: "Auth not yet implemented" })
  },
}
