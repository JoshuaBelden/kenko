import { clearSessionCookie, deleteSession, getSessionToken } from "$lib/server/auth"
import { redirect } from "@sveltejs/kit"
import type { Actions } from "./$types"

export const actions: Actions = {
  default: async ({ cookies }) => {
    const token = getSessionToken(cookies)
    if (token) {
      await deleteSession(token)
    }
    clearSessionCookie(cookies)
    throw redirect(303, "/login")
  },
}
