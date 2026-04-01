import { hashPassword, verifyPassword } from "$lib/server/auth"
import { getUsersCollection } from "$lib/server/collections"
import { fail } from "@sveltejs/kit"
import { ObjectId } from "mongodb"
import type { Actions } from "./$types"

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    if (!locals.userId) return fail(401)

    const data = await request.formData()
    const firstName = (data.get("firstName") as string)?.trim()
    const lastName = (data.get("lastName") as string)?.trim()
    const weight = data.get("weight") ? Number(data.get("weight")) : undefined
    const height = data.get("height") ? Number(data.get("height")) : undefined
    const sex = data.get("sex") as "male" | "female" | null
    const bmi = data.get("bmi") ? Number(data.get("bmi")) : undefined
    const bodyFatPercent = data.get("bodyFatPercent") ? Number(data.get("bodyFatPercent")) : undefined

    if (!firstName || !lastName) {
      return fail(400, { profileError: "First and last name are required." })
    }

    const users = await getUsersCollection()
    await users.updateOne(
      { _id: new ObjectId(locals.userId) },
      {
        $set: {
          profile: {
            firstName,
            lastName,
            weight: weight || undefined,
            height: height || undefined,
            sex: sex || undefined,
            bmi: bmi || undefined,
            bodyFatPercent: bodyFatPercent || undefined,
          },
          profileComplete: true,
          updatedAt: new Date(),
        },
      },
    )

    return { profileSuccess: true }
  },

  updatePassword: async ({ request, locals }) => {
    if (!locals.userId) return fail(401)

    const data = await request.formData()
    const currentPassword = data.get("currentPassword") as string
    const newPassword = data.get("newPassword") as string
    const confirmNewPassword = data.get("confirmNewPassword") as string

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return fail(400, { passwordError: "All password fields are required." })
    }

    if (newPassword !== confirmNewPassword) {
      return fail(400, { passwordError: "New passwords do not match." })
    }

    if (newPassword.length < 8) {
      return fail(400, { passwordError: "Password must be at least 8 characters." })
    }

    const users = await getUsersCollection()
    const user = await users.findOne({ _id: new ObjectId(locals.userId) })
    if (!user) return fail(401)

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      return fail(400, { passwordError: "Current password is incorrect." })
    }

    const passwordHash = await hashPassword(newPassword)
    await users.updateOne({ _id: new ObjectId(locals.userId) }, { $set: { passwordHash, updatedAt: new Date() } })

    return { passwordSuccess: true }
  },
}
