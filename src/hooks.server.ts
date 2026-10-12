import { ensureIndexes, getSessionToken, getSessionUserId } from "$lib/server/auth"
import { getUsersCollection } from "$lib/server/collections"
import { autoCheckDefaultCommitments } from "$lib/server/kata"
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

      const users = await getUsersCollection()
      const user = await users.findOne(
        { _id: new ObjectId(userId) },
        { projection: { profileComplete: 1, isAdmin: 1, "profile.timezone": 1, "profile.latitude": 1, "profile.longitude": 1 } },
      )

      const userTimezone = user?.profile?.timezone ?? "America/Los_Angeles"
      event.locals.userTimezone = userTimezone
      event.locals.isAdmin = user?.isAdmin ?? false

      try {
        await autoCheckDefaultCommitments(new ObjectId(userId), userTimezone)
      } catch (err) {
        console.error("Failed to auto-check default commitments", err)
      }

      // Check if profile is complete — redirect incomplete profiles to /profile
      if (!event.url.pathname.startsWith("/profile") && event.url.pathname !== "/logout") {
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
