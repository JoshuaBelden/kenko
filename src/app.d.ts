declare global {
  namespace App {
    interface Locals {
      userId?: string
      userTimezone?: string
    }
    interface PageData {
      user: {
        id: string
        email: string
        profileComplete: boolean
        profile: {
          firstName: string
          lastName: string
          weight?: number
          height?: number
          sex?: "male" | "female"
          bmi?: number
          bodyFatPercent?: number
          birthDate?: string
          activityLevel?: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active"
          tdeeOverride?: number | null
          timezone?: string
          zipCode?: string
          latitude?: number
          longitude?: number
        } | null
      } | null
      activeJourneys: Array<{
        id: string
        name: string
        startDate: string
        endDate: string
      }>
    }
  }
}

export {}
