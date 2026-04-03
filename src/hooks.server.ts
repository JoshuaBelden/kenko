import { ensureIndexes, getSessionToken, getSessionUserId } from "$lib/server/auth"
import { getUsersCollection } from "$lib/server/collections"
import { redirect, type Handle } from "@sveltejs/kit"
import { ObjectId } from "mongodb"

const PUBLIC_ROUTES = ["/login", "/register"]

ensureIndexes()

export const handle: Handle = async ({ event, resolve }) => {
  const token = getSessionToken(event.cookies)

  if (token) {
    const userId = await getSessionUserId(token)
    if (userId) {
      event.locals.userId = userId

      // Check if profile is complete — redirect incomplete profiles to /profile
      if (!event.url.pathname.startsWith("/profile") && event.url.pathname !== "/logout") {
        const users = await getUsersCollection()
        const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: { profileComplete: 1 } })
        if (user && !user.profileComplete) {
          throw redirect(303, "/profile")
        }
      }

      // Authenticated users shouldn't see auth pages
      if (PUBLIC_ROUTES.includes(event.url.pathname)) {
        throw redirect(303, "/tabi")
      }
    }
  }

  // Unauthenticated users can only access public routes
  if (!event.locals.userId && !PUBLIC_ROUTES.includes(event.url.pathname)) {
    throw redirect(303, "/login")
  }

  return resolve(event)
}
