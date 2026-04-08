import { geocodeZip } from "$lib/server/weatherApi"
import { json, type RequestHandler } from "@sveltejs/kit"

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.userId) return json({ error: "Unauthorized" }, { status: 401 })

  const zip = url.searchParams.get("zip")
  if (!zip) return json({ error: "zip is required" }, { status: 400 })

  const result = await geocodeZip(zip)
  if (!result) return json({ error: "Could not find location for that zip code" }, { status: 404 })

  return json(result)
}
