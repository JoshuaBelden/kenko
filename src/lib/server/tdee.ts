export type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active"

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
}

interface TdeeInput {
  weightLbs: number
  heightIn: number
  sex: "male" | "female"
  birthDate: string
  activityLevel: ActivityLevel
}

function getAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function calculateTdee(input: TdeeInput): { bmr: number; multiplier: number; tdee: number } {
  const weightKg = input.weightLbs * 0.453592
  const heightCm = input.heightIn * 2.54
  const age = getAge(input.birthDate)

  let bmr: number
  if (input.sex === "male") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }

  const multiplier = ACTIVITY_MULTIPLIERS[input.activityLevel]
  const tdee = Math.round(bmr * multiplier)

  return { bmr: Math.round(bmr), multiplier, tdee }
}
