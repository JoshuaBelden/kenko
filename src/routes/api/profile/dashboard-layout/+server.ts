import { getUsersCollection } from "$lib/server/collections"
import { isDashboardWidgetId } from "$lib/dashboardWidgets"
import { json } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { RequestHandler } from "./$types"

/** Saves the journey dashboard widget order and collapsed widgets to the user's profile. */
export const PUT: RequestHandler = async ({ locals, request }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { order, collapsed } = body
  if (!Array.isArray(order) || !order.every(isDashboardWidgetId)) {
    return json({ error: "Invalid widget order" }, { status: 400 })
  }
  if (!Array.isArray(collapsed) || !collapsed.every(isDashboardWidgetId)) {
    return json({ error: "Invalid collapsed widgets" }, { status: 400 })
  }

  const users = await getUsersCollection()
  await users.updateOne(
    { _id: new ObjectId(locals.userId) },
    {
      $set: {
        "profile.dashboardLayout": { order: [...new Set(order)], collapsed: [...new Set(collapsed)] },
        updatedAt: new Date(),
      },
    },
  )

  return json({ ok: true })
}
