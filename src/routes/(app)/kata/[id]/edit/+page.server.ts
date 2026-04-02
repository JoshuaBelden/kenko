import { getCommitmentsCollection, serializeCommitment } from "$lib/server/kata"
import { ObjectId } from "mongodb"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.userId) return { commitment: null }

  const userId = new ObjectId(locals.userId)
  const commitmentsCol = await getCommitmentsCollection()
  const commitment = await commitmentsCol.findOne({ _id: new ObjectId(params.id), userId })

  if (!commitment) return { commitment: null }
  return { commitment: serializeCommitment(commitment) }
}
