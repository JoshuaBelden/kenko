<script lang="ts">
  import { goto, invalidate, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { flip } from "svelte/animate"
  import { Button, Card, DashboardWidget, DaySticker, ProgressBar, RadialProgress, StarRating, DotRating, TipTapEditor, WeekMedal } from "$lib/components"
  import { isDashboardWidgetId, resolveWidgetOrder, type DashboardWidgetId } from "$lib/dashboardWidgets"
  import SettingsTabs from "$lib/components/settings/SettingsTabs.svelte"
  import TrainerChat from "$lib/components/TrainerChat.svelte"
  import { localToday, localDateStr, localTimeStr, toDatetime } from "$lib/dates"
  import { formatDate, formatDateShort, formatPace } from "$lib/format"
  import { icons } from "$lib/icons"
  import { DEFAULT_KICKOFF_PROMPT, DEFAULT_SYSTEM_PROMPT, DEFAULT_TRAINER_MODEL, trainerModelLabel } from "$lib/trainer"
  import { DEFAULT_WORKOUT_TYPES, type WorkoutType } from "$lib/workoutTypes"
  import { tooltip } from "$lib/tooltip.svelte"

  function weightDotTooltip(date: string, weight: number, unit = "lbs"): string {
    const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return `${label}: ${weight} ${unit}`
  }

  const data = $derived(page.data as any)
  const tz = $derived(page.data.user?.profile?.timezone ?? "America/Los_Angeles")
  const journey = $derived(data.journey)
  const allPlans = $derived(data.allPlans ?? [])
  const allCommitments = $derived(data.allCommitments ?? [])
  const tdee = $derived(data.tdee as number | null)
  const categories = $derived(data.categories ?? [])
  const mealPlanFoods = $derived(data.mealPlanFoods ?? [])
  const trainerKey = $derived(data.trainerKey ?? { hasKey: false, last4: null })

  // Determine if newly created (no targets configured)
  const hasAnyTargets = $derived(
    journey?.shokuTargets || journey?.danjikiTargets || journey?.dojoTargets || journey?.kataTargets,
  )

  type Tab = "overview" | "journal" | "progress" | "guidance"
  const TABS: Tab[] = ["overview", "journal", "progress", "guidance"]
  const initialTab = page.url.searchParams.get("tab") as Tab | null
  let activeTab = $state<Tab>(initialTab && TABS.includes(initialTab) ? initialTab : "overview")
  let showSettings = $state(false)

  // ── Guidance tab ──
  type GuidanceSummary = { id: string; date: string; requestedAt: string; model: string }
  let guidanceList = $state<GuidanceSummary[]>([])
  let guidanceTodayId = $state<string | null>(null)
  let guidanceHasKey = $state(false)
  let guidanceLoading = $state(false)
  let guidanceLoaded = $state(false)
  let guidanceRequesting = $state(false)
  let guidanceError = $state("")

  $effect(() => {
    if (activeTab === "guidance" && journey && !guidanceLoaded) loadGuidance()
  })

  async function loadGuidance() {
    guidanceLoading = true
    guidanceError = ""
    try {
      const res = await fetch(`/api/guidance?journeyId=${journey.id}`)
      if (!res.ok) throw new Error()
      const body = await res.json()
      guidanceList = body.guidance
      guidanceTodayId = body.todayId
      guidanceHasKey = body.hasApiKey
      guidanceLoaded = true
    } catch {
      guidanceError = "Couldn't load your guidance history."
    } finally {
      guidanceLoading = false
    }
  }

  async function requestGuidance() {
    if (guidanceTodayId) {
      goto(`/tabi/${journey.id}/guidance/${guidanceTodayId}`)
      return
    }
    guidanceRequesting = true
    guidanceError = ""
    try {
      const res = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: journey.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Couldn't start your guidance. Please try again.")
      goto(`/tabi/${journey.id}/guidance/${body.id}`)
    } catch (err) {
      guidanceError = err instanceof Error ? err.message : "Couldn't start your guidance. Please try again."
      guidanceRequesting = false
    }
  }

  // ── Progress tab: calendar state ──
  type CalendarView = "week" | "month"
  let calendarViewMode = $state<CalendarView>("week")
  let calendarMonth = $state(new Date())
  const calendarToday = $derived(localToday(tz))
  let calendarData = $state<Record<string, any>>({})
  let calendarWeeks = $state<Record<string, any>>({})
  let calendarTdee = $state<number | null>(null)
  let calendarLoading = $state(false)
  let selectedDay = $state<string | null>(null)
  let progressSidebarOpen = $state(false)

  function dateStrOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  // Monday-start week: JS getDay() is 0=Sun..6=Sat, so shift by (dow + 6) % 7 days back to Monday
  function startOfWeekMonday(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    return date
  }

  // Visible grid range: one Monday–Sunday week, or the month padded out to full weeks
  const calendarRange = $derived.by(() => {
    const start =
      calendarViewMode === "month"
        ? startOfWeekMonday(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1))
        : startOfWeekMonday(calendarMonth)
    const end =
      calendarViewMode === "month"
        ? startOfWeekMonday(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0))
        : new Date(start)
    end.setDate(end.getDate() + 6)
    return { start, end }
  })

  const calendarLoadKey = $derived(`${dateStrOf(calendarRange.start)}_${dateStrOf(calendarRange.end)}`)

  let lastLoadedKey = ""
  $effect(() => {
    if (activeTab === "progress" && journey) {
      const key = calendarLoadKey
      if (key !== lastLoadedKey) {
        lastLoadedKey = key
        loadCalendarData(key)
      }
    }
  })

  async function loadCalendarData(key: string) {
    calendarLoading = true
    try {
      const [start, end] = key.split("_")
      const res = await fetch(`/api/journeys/${journey.id}/calendar?start=${start}&end=${end}`)
      if (!res.ok) throw new Error(`Calendar request failed: ${res.status}`)
      const result = await res.json()
      // Ignore a stale response if the user navigated while it was in flight
      if (key === lastLoadedKey) {
        calendarData = result.days ?? {}
        calendarWeeks = result.weeks ?? {}
        calendarTdee = result.tdee ?? null
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err)
    }
    if (key === lastLoadedKey) calendarLoading = false
  }

  function dayData(dateStr: string) {
    return calendarData[dateStr] ?? null
  }

  function dayHasData(dateStr: string): boolean {
    return !!calendarData[dateStr]
  }

  // `outside` marks days from the previous/next month that pad out the month grid
  type Cell = { day: number; dateStr: string; outside: boolean }

  const calendarRows = $derived.by(() => {
    const { start, end } = calendarRange
    const month = calendarMonth.getMonth()
    const flat: Cell[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      flat.push({ day: d.getDate(), dateStr: dateStrOf(d), outside: calendarViewMode === "month" && d.getMonth() !== month })
    }

    // Chunk into rows of 7 days + 1 summary cell
    const rows: { days: Cell[]; weekIndex: number }[] = []
    for (let i = 0; i < flat.length; i += 7) {
      rows.push({ days: flat.slice(i, i + 7), weekIndex: rows.length })
    }
    return rows
  })

  const STICKER_STATUS_MARK: Record<string, string> = { hit: "✓", close: "~", miss: "✗" }

  function awardTooltip(title: string, goals: { label: string; status: string; detail: string }[]): string {
    return [title, ...goals.map((g) => `${STICKER_STATUS_MARK[g.status]} ${g.label} ${g.detail}`)].join("\n")
  }

  const calendarMonthLabel = $derived(
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarMonth),
  )

  const calendarWeekLabel = $derived.by(() => {
    const start = startOfWeekMonday(calendarMonth)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    const startFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    const endFmt = new Intl.DateTimeFormat(
      "en-US",
      sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    )
    return `${startFmt.format(start)} – ${endFmt.format(end)}`
  })

  const calendarHeaderLabel = $derived(calendarViewMode === "month" ? calendarMonthLabel : calendarWeekLabel)

  function calendarPrev() {
    const d = new Date(calendarMonth)
    if (calendarViewMode === "month") d.setMonth(d.getMonth() - 1)
    else d.setDate(d.getDate() - 7)
    calendarMonth = d
  }

  function calendarNext() {
    const d = new Date(calendarMonth)
    if (calendarViewMode === "month") d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 7)
    calendarMonth = d
  }

  // Show settings by default only if no targets and no description configured
  let settingsAutoShown = $state(false)
  $effect(() => {
    if (journey && !hasAnyTargets && !journey.description && !settingsAutoShown) {
      settingsAutoShown = true
      showSettings = true
    }
  })

  // Journey status helpers
  const isEnded = $derived(journey && new Date(journey.endDate) < new Date())
  const isArchived = $derived(journey?.status === "archived")

  // Journey progress
  const totalDays = $derived(journey ? Math.ceil((new Date(journey.endDate).getTime() - new Date(journey.startDate).getTime()) / 86400000) : 0)
  const daysIn = $derived(journey ? Math.max(0, Math.min(totalDays, Math.ceil((Date.now() - new Date(journey.startDate).getTime()) / 86400000))) : 0)
  const daysLeft = $derived(totalDays - daysIn)
  const pctComplete = $derived(totalDays > 0 ? Math.round((daysIn / totalDays) * 100) : 0)

  // ── Settings state ──
  let settingsName = $state("")
  let settingsDesc = $state("")
  let settingsStatement = $state<string | null>(null)
  let settingsStartDate = $state("")
  let settingsStartTime = $state("00:00")
  let settingsEndDate = $state("")
  let settingsEndTime = $state("23:59")
  let saving = $state(false)
  let saveError = $state("")
  let saveSuccess = $state(false)

  // Shoku settings
  let weightGoalLbsPerWeek = $state("0")
  let targetWeight = $state("")
  let dailyCalorieOverride = $state(false)
  let dailyCalorieTarget = $state("")
  let macroMode = $state<"percentage" | "grams">("percentage")
  let proteinValue = $state("")
  let carbsValue = $state("")
  let fatValue = $state("")
  let dailyWaterTargetOz = $state("")

  // Fasting settings
  let weeklyFastingHours = $state("")

  // Workout settings
  let selectedPlanIds = $state<string[]>([])
  let dojoSessionsPerWeek = $state("")
  let dojoWeeklyCalorieBurn = $state("")
  let workoutTypes = $state<WorkoutType[]>(DEFAULT_WORKOUT_TYPES)

  // Habits settings
  let selectedCommitmentIds = $state<string[]>([])

  // Meal plan settings
  let mealPlanItems = $state<any[]>([])
  let mealBuilds = $state<any[]>([])

  // Trainer settings
  let trainerApiKeyDraft = $state("")
  let trainerModel = $state<string>(DEFAULT_TRAINER_MODEL)
  let trainerSystemPrompt = $state(DEFAULT_SYSTEM_PROMPT)
  let trainerKickoffPrompt = $state(DEFAULT_KICKOFF_PROMPT)

  // Effective calorie target (needed for saveSettings)
  const effectiveCalorieTarget = $derived(() => {
    if (dailyCalorieOverride && dailyCalorieTarget) return Number(dailyCalorieTarget)
    if (!tdee) return null
    const goal = Number(weightGoalLbsPerWeek)
    const deficit = goal ? Math.round(goal * 500) : 0
    return tdee + deficit
  })

  function handleSettingsChange(field: string, value: any) {
    switch (field) {
      case "name": settingsName = value; break
      case "description": settingsDesc = value; break
      case "statement": settingsStatement = value; break
      case "startDate": settingsStartDate = value; break
      case "startTime": settingsStartTime = value; break
      case "endDate": settingsEndDate = value; break
      case "endTime": settingsEndTime = value; break
      case "weightGoalLbsPerWeek": weightGoalLbsPerWeek = value; break
      case "targetWeight": targetWeight = value; break
      case "dailyCalorieOverride": dailyCalorieOverride = value; break
      case "dailyCalorieTarget": dailyCalorieTarget = value; break
      case "macroMode": macroMode = value; break
      case "proteinValue": proteinValue = value; break
      case "carbsValue": carbsValue = value; break
      case "fatValue": fatValue = value; break
      case "dailyWaterTargetOz": dailyWaterTargetOz = value; break
      case "weeklyFastingHours": weeklyFastingHours = value; break
      case "selectedPlanIds": selectedPlanIds = value; break
      case "sessionsPerWeek": dojoSessionsPerWeek = value; break
      case "weeklyCalorieBurn": dojoWeeklyCalorieBurn = value; break
      case "workoutTypes": workoutTypes = value; break
      case "selectedCommitmentIds": selectedCommitmentIds = value; break
      case "mealPlanItems": mealPlanItems = value; break
      case "mealBuilds": mealBuilds = value; break
      case "trainerApiKeyDraft": trainerApiKeyDraft = value; break
      case "trainerModel": trainerModel = value; break
      case "trainerSystemPrompt": trainerSystemPrompt = value; break
      case "trainerKickoffPrompt": trainerKickoffPrompt = value; break
    }
  }

  // Sync settings from journey data — only on load and after save
  let syncVersion = $state(0)
  $effect(() => {
    const j = journey
    void syncVersion // track version to re-run after save
    if (!j) return

    settingsName = j.name ?? ""
    settingsDesc = j.description ?? ""
    settingsStatement = j.statement ?? null
    settingsStartDate = j.startDate ? localDateStr(j.startDate, tz) : ""
    settingsStartTime = j.startDate ? localTimeStr(j.startDate, tz) : "00:00"
    settingsEndDate = j.endDate ? localDateStr(j.endDate, tz) : ""
    settingsEndTime = j.endDate ? localTimeStr(j.endDate, tz) : "23:59"

    const s = j.shokuTargets
    if (s) {
      weightGoalLbsPerWeek = s.weightGoalLbsPerWeek?.toString() ?? "0"
      targetWeight = s.targetWeight?.toString() ?? ""
      dailyCalorieOverride = s.dailyCalorieOverride ?? false
      dailyCalorieTarget = s.dailyCalorieTarget?.toString() ?? ""
      // Determine macro mode from first macro that has a value
      const firstMacro = s.macros?.protein ?? s.macros?.carbs ?? s.macros?.fat
      const initialMode = firstMacro?.percentage != null ? "percentage" : "grams"
      macroMode = initialMode
      if (s.macros?.protein) {
        proteinValue = (initialMode === "percentage" ? s.macros.protein.percentage : s.macros.protein.grams)?.toString() ?? ""
      }
      if (s.macros?.carbs) {
        carbsValue = (initialMode === "percentage" ? s.macros.carbs.percentage : s.macros.carbs.grams)?.toString() ?? ""
      }
      if (s.macros?.fat) {
        fatValue = (initialMode === "percentage" ? s.macros.fat.percentage : s.macros.fat.grams)?.toString() ?? ""
      }
      dailyWaterTargetOz = s.dailyWaterTargetOz?.toString() ?? ""
    }

    const d = j.danjikiTargets
    if (d) {
      weeklyFastingHours = d.weeklyFastingHours?.toString() ?? ""
    }

    const dj = j.dojoTargets
    if (dj) {
      selectedPlanIds = dj.planIds ?? []
      dojoSessionsPerWeek = dj.sessionsPerWeek?.toString() ?? ""
      dojoWeeklyCalorieBurn = dj.weeklyCalorieBurn?.toString() ?? ""
    }

    workoutTypes = j.workoutTypes ?? DEFAULT_WORKOUT_TYPES

    const k = j.kataTargets
    if (k) {
      selectedCommitmentIds = k.commitmentIds ?? []
    }

    mealPlanItems = j.shokuMealPlan?.items ?? []
    mealBuilds = j.shokuMealBuilds ?? []

    trainerModel = j.trainerSettings?.model ?? DEFAULT_TRAINER_MODEL
    trainerSystemPrompt = j.trainerSettings?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    trainerKickoffPrompt = j.trainerSettings?.kickoffPrompt ?? DEFAULT_KICKOFF_PROMPT
  })

  async function saveSettings() {
    saving = true
    saveError = ""
    saveSuccess = false

    if (!settingsName.trim()) {
      saveError = "Journey name is required."
      saving = false
      return
    }

    const calTarget = effectiveCalorieTarget()

    const hasShoku =
      Number(weightGoalLbsPerWeek) !== 0 || targetWeight || dailyCalorieTarget || proteinValue || carbsValue || fatValue || dailyWaterTargetOz
    const shokuTargets = hasShoku
        ? {
            weightGoalLbsPerWeek: Number(weightGoalLbsPerWeek) || null,
            targetWeight: targetWeight ? Number(targetWeight) : null,
            dailyCalorieTarget: dailyCalorieOverride && dailyCalorieTarget ? Number(dailyCalorieTarget) : (calTarget ?? null),
            dailyCalorieOverride,
            macros: {
              protein: {
                percentage: macroMode === "percentage" && proteinValue ? Number(proteinValue) : null,
                grams: macroMode === "grams" && proteinValue ? Number(proteinValue) : null,
              },
              carbs: {
                percentage: macroMode === "percentage" && carbsValue ? Number(carbsValue) : null,
                grams: macroMode === "grams" && carbsValue ? Number(carbsValue) : null,
              },
              fat: {
                percentage: macroMode === "percentage" && fatValue ? Number(fatValue) : null,
                grams: macroMode === "grams" && fatValue ? Number(fatValue) : null,
              },
            },
            dailyWaterTargetOz: dailyWaterTargetOz ? Number(dailyWaterTargetOz) : null,
          }
        : null

    const danjikiTargets = weeklyFastingHours
      ? { weeklyFastingHours: Number(weeklyFastingHours) }
      : null

    const dojoTargets =
      selectedPlanIds.length > 0 || dojoSessionsPerWeek || dojoWeeklyCalorieBurn
        ? {
            planIds: selectedPlanIds,
            sessionsPerWeek: dojoSessionsPerWeek ? Number(dojoSessionsPerWeek) : null,
            weeklyCalorieBurn: dojoWeeklyCalorieBurn ? Number(dojoWeeklyCalorieBurn) : null,
          }
        : null

    const kataTargets = selectedCommitmentIds.length > 0
      ? { commitmentIds: selectedCommitmentIds }
      : null

    const shokuMealPlan = mealPlanItems.length > 0
      ? { items: mealPlanItems }
      : null

    const shokuMealBuilds = mealBuilds.length > 0
      ? mealBuilds
      : []

    // The API key is saved separately (it lives on the user, encrypted) and verified with Anthropic first
    if (trainerApiKeyDraft.trim()) {
      const keyRes = await fetch("/api/trainer/key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trainerApiKeyDraft.trim() }),
      })
      if (!keyRes.ok) {
        const err = await keyRes.json().catch(() => ({}))
        saveError = err.error ?? "Couldn't save your API key."
        saving = false
        return
      }
      trainerApiKeyDraft = ""
    }

    const res = await fetch(`/api/journeys/${journey.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: settingsName.trim(),
        description: settingsDesc.trim(),
        statement: settingsStatement,
        startDate: toDatetime(settingsStartDate, settingsStartTime, tz),
        endDate: toDatetime(settingsEndDate, settingsEndTime, tz),
        shokuTargets,
        danjikiTargets,
        dojoTargets,
        workoutTypes,
        kataTargets,
        shokuMealPlan,
        shokuMealBuilds,
        trainerSettings: {
          model: trainerModel,
          systemPrompt: trainerSystemPrompt,
          kickoffPrompt: trainerKickoffPrompt,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      saveError = err.error ?? "Failed to save."
    } else {
      saveSuccess = true
      await invalidateAll()
      syncVersion++
      setTimeout(() => (saveSuccess = false), 2000)
    }
    saving = false
  }

  async function removeTrainerKey() {
    await fetch("/api/trainer/key", { method: "DELETE" })
    await invalidateAll()
  }

  async function archiveJourney() {
    await fetch(`/api/journeys/${journey.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    })
    goto("/tabi")
  }

  async function unarchiveJourney() {
    await fetch(`/api/journeys/${journey.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    })
    await invalidateAll()
  }

  async function deleteJourney() {
    await fetch(`/api/journeys/${journey.id}`, { method: "DELETE" })
    goto("/tabi")
  }

  // ── Overview data ──
  let overviewData = $state<any>(null)
  let overviewLoading = $state(false)

  async function loadOverview() {
    if (!hasAnyTargets) return
    overviewLoading = true
    const res = await fetch(`/api/journeys/${journey.id}/overview`)
    if (res.ok) overviewData = await res.json()
    overviewLoading = false
  }

  $effect(() => {
    if (journey && hasAnyTargets && (activeTab === "overview" || activeTab === "progress") && !showSettings) {
      loadOverview()
    }
  })

  // ── Progress weight chart (scoped to calendar month, projection 1 month out) ──
  const progressWeightChart = $derived.by(() => {
    const w = overviewData?.weight
    if (!w || !w.entries.length) return null

    const allEntries = w.entries as Array<{ date: string; weight: number }>
    const goalRate = w.weightGoalLbsPerWeek as number | null

    // Filter entries to the selected calendar month
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`
    const entries = allEntries.filter((e) => e.date.startsWith(monthPrefix))
    if (!entries.length) return null

    // X-axis: first of month → 1 month after end of month
    const monthStart = new Date(year, month, 1)
    const projectionEnd = new Date(year, month + 2, 0) // last day of next month

    const totalMs = projectionEnd.getTime() - monthStart.getTime()
    if (totalMs <= 0) return null

    const firstEntry = entries[0]
    const lastEntry = entries[entries.length - 1]

    // Goal weight projected to projection end
    const weeksToEnd = (projectionEnd.getTime() - new Date(firstEntry.date + "T12:00:00").getTime()) / (7 * 86400000)
    const goalWeightAtEnd = goalRate ? firstEntry.weight + goalRate * weeksToEnd : null

    // Y-axis bounds
    const actualWeights = entries.map((e) => e.weight)
    const allWeights = [...actualWeights, ...(goalWeightAtEnd != null ? [goalWeightAtEnd] : [])]
    const minW = Math.min(...allWeights)
    const maxW = Math.max(...allWeights)
    const padding = Math.max((maxW - minW) * 0.15, 1)

    return {
      entries,
      goalRate,
      goalWeightAtEnd,
      chartStart: monthStart,
      chartEnd: projectionEnd,
      totalMs,
      lastEntry,
      firstEntry,
      yMin: minW - padding,
      yMax: maxW + padding,
      startLabel: `${String(month + 1).padStart(2, "0")}-01`,
      endLabel: `${String(projectionEnd.getMonth() + 1).padStart(2, "0")}-${String(projectionEnd.getDate()).padStart(2, "0")}`,
    }
  })

  // ── Weight progress card (Overview tab, current vs. target weight) ──
  type WeightCardRange = "week" | "month" | "all"
  let weightCardRange = $state<WeightCardRange>("week")

  type TrendSeries = {
    entries: Array<{ date: string; weight: number }>
    trendStart: { date: string; weight: number }
    trendEnd: { date: string; weight: number }
    yMin: number
    yMax: number
  }

  /** Least-squares trend and y-range for a measurement series; `refs` are extra values the y-range must include. */
  function buildTrendSeries(entries: Array<{ date: string; weight: number }>, chartStart: Date, refs: number[] = []): TrendSeries {
    const xs = entries.map((e) => (new Date(e.date + "T00:00:00").getTime() - chartStart.getTime()) / 86400000)
    const ys = entries.map((e) => e.weight)
    const n = xs.length
    const sumX = xs.reduce((a, x) => a + x, 0)
    const sumY = ys.reduce((a, y) => a + y, 0)
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
    const sumXX = xs.reduce((a, x) => a + x * x, 0)
    const denom = n * sumXX - sumX * sumX
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
    const intercept = sumY / n - (slope * sumX) / n

    const trendStart = { date: entries[0].date, weight: intercept + slope * xs[0] }
    const trendEnd = { date: entries[n - 1].date, weight: intercept + slope * xs[n - 1] }

    const all = [...ys, ...refs, trendStart.weight, trendEnd.weight]
    const minW = Math.min(...all)
    const maxW = Math.max(...all)
    const padding = Math.max((maxW - minW) * 0.15, 1)

    return { entries, trendStart, trendEnd, yMin: minW - padding, yMax: maxW + padding }
  }

  const weightProgressCard = $derived.by(() => {
    const w = overviewData?.weight
    const targetWeightGoal = w?.targetWeight as number | null | undefined
    if (!w || targetWeightGoal == null) return null

    const currentWeight = page.data.user?.profile?.weight ?? null
    const allEntries = w.entries as Array<{ date: string; weight: number }>
    const allWaist = ((w.waistEntries ?? []) as Array<{ date: string; waist: number }>).map((e) => ({
      date: e.date,
      weight: e.waist,
    }))
    const currentWaist = allWaist.at(-1)?.weight ?? null

    const todayDate = new Date(calendarToday + "T00:00:00")
    const cutoff =
      weightCardRange === "week"
        ? new Date(todayDate.getTime() - 6 * 86400000)
        : weightCardRange === "month"
          ? new Date(todayDate.getTime() - 29 * 86400000)
          : null

    const inRange = (e: { date: string }) => !cutoff || new Date(e.date + "T00:00:00").getTime() >= cutoff.getTime()
    const entries = allEntries.filter(inRange)
    const waistEntries = allWaist.filter(inRange)

    if (!entries.length && !waistEntries.length) {
      return { hasEntries: false as const, targetWeight: targetWeightGoal, currentWeight, currentWaist }
    }

    // Both charts share the x-axis so weight and waist line up by date
    const firstDate = [entries[0]?.date, waistEntries[0]?.date].filter(Boolean).sort()[0] as string
    const chartStart = cutoff ?? new Date(firstDate + "T00:00:00")
    const chartEnd = todayDate
    const totalMs = Math.max(chartEnd.getTime() - chartStart.getTime(), 1)

    return {
      hasEntries: true as const,
      targetWeight: targetWeightGoal,
      currentWeight,
      currentWaist,
      chartStart,
      chartEnd,
      totalMs,
      weight: entries.length ? buildTrendSeries(entries, chartStart, [targetWeightGoal]) : null,
      waist: waistEntries.length ? buildTrendSeries(waistEntries, chartStart) : null,
    }
  })

  // ── Running progress card (weekly pace and mileage across the journey) ──
  type RunWeek = { weekStart: string; runs: number; miles: number; avgPace: number | null }

  const runningChart = $derived.by(() => {
    const weeks = (overviewData?.running?.weeks ?? []) as RunWeek[]
    if (!weeks.length) return null

    const paced = weeks
      .map((w, i) => ({ ...w, i }))
      .filter((w): w is RunWeek & { i: number; avgPace: number } => w.avgPace != null)

    // Least-squares trend of weekly pace over week index
    let trend: { x1: number; y1: number; x2: number; y2: number } | null = null
    if (paced.length >= 2) {
      const n = paced.length
      const sumX = paced.reduce((a, p) => a + p.i, 0)
      const sumY = paced.reduce((a, p) => a + p.avgPace, 0)
      const sumXY = paced.reduce((a, p) => a + p.i * p.avgPace, 0)
      const sumXX = paced.reduce((a, p) => a + p.i * p.i, 0)
      const denom = n * sumXX - sumX * sumX
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
      const intercept = sumY / n - (slope * sumX) / n
      const first = paced[0].i
      const last = paced[n - 1].i
      trend = { x1: first, y1: intercept + slope * first, x2: last, y2: intercept + slope * last }
    }

    const paces = [...paced.map((p) => p.avgPace), ...(trend ? [trend.y1, trend.y2] : [])]
    const minP = paces.length ? Math.min(...paces) : 0
    const maxP = paces.length ? Math.max(...paces) : 0
    const padding = Math.max((maxP - minP) * 0.15, 0.25)

    return {
      weeks,
      paced,
      trend,
      yMin: minP - padding,
      yMax: maxP + padding,
      maxMiles: Math.max(...weeks.map((w) => w.miles), 1),
    }
  })

  function runWeekTooltip(w: RunWeek): string {
    const pace = w.avgPace != null ? `${formatPace(w.avgPace, false)} /mi · ` : ""
    return `Week of ${formatDateShort(w.weekStart, tz)}: ${pace}${w.miles} mi (${w.runs} run${w.runs === 1 ? "" : "s"})`
  }

  // ── Dashboard layout (order + collapsed widgets, saved to the user profile) ──
  const WEIGHT_ICON = '<path d="M3 3v18h18"/><polyline points="7 14 11 10 14 13 20 7"/>'
  const savedLayout = page.data.user?.profile?.dashboardLayout
  let widgetOrder = $state<DashboardWidgetId[]>(resolveWidgetOrder(savedLayout?.order))
  let collapsedWidgets = $state<DashboardWidgetId[]>((savedLayout?.collapsed ?? []).filter(isDashboardWidgetId))
  let draggingWidget = $state<DashboardWidgetId | null>(null)
  let lastReorderAt = 0
  let saveLayoutTimer: ReturnType<typeof setTimeout> | undefined

  function isWidgetVisible(id: DashboardWidgetId): boolean {
    switch (id) {
      case "shoku": return !!(journey.shokuTargets && overviewData?.shoku)
      case "weight": return !!weightProgressCard
      case "kata": return !!(journey.kataTargets && overviewData?.kata)
      case "dojo": return !!(journey.dojoTargets && overviewData?.dojo)
      case "running": return !!overviewData?.running && (!!journey.dojoTargets || overviewData.running.summary.totalRuns > 0)
      case "danjiki": return !!(journey.danjikiTargets && overviewData?.danjiki)
    }
  }

  const visibleWidgets = $derived(overviewData ? widgetOrder.filter(isWidgetVisible) : [])

  function saveLayout() {
    clearTimeout(saveLayoutTimer)
    saveLayoutTimer = setTimeout(async () => {
      const res = await fetch("/api/profile/dashboard-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: widgetOrder, collapsed: collapsedWidgets }),
      })
      // Refresh only the root layout's profile so returning to this page restores the saved layout
      if (res.ok) await invalidate("app:profile")
    }, 400)
  }

  /** Moves `id` into `overId`'s slot, shifting the cards in between. */
  function moveWidget(id: DashboardWidgetId, overId: DashboardWidgetId) {
    const next = widgetOrder.filter((w) => w !== id)
    next.splice(widgetOrder.indexOf(overId), 0, id)
    widgetOrder = next
  }

  function toggleWidget(id: DashboardWidgetId) {
    collapsedWidgets = collapsedWidgets.includes(id)
      ? collapsedWidgets.filter((w) => w !== id)
      : [...collapsedWidgets, id]
    saveLayout()
  }

  function startWidgetDrag(id: DashboardWidgetId, e: PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    draggingWidget = id
  }

  function dragWidget(e: PointerEvent) {
    if (!draggingWidget) return
    // Let the flip animation settle so cards sliding under the pointer don't bounce back
    if (Date.now() - lastReorderAt < 220) return
    const overId = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-widget-id]")?.getAttribute("data-widget-id")
    if (!isDashboardWidgetId(overId) || overId === draggingWidget) return
    moveWidget(draggingWidget, overId)
    lastReorderAt = Date.now()
  }

  function endWidgetDrag() {
    if (!draggingWidget) return
    draggingWidget = null
    saveLayout()
  }

  function nudgeWidget(id: DashboardWidgetId, direction: -1 | 1) {
    const target = visibleWidgets[visibleWidgets.indexOf(id) + direction]
    if (!target) return
    moveWidget(id, target)
    saveLayout()
  }

  function weatherIcon(code: number): string {
    if (code === 0) return "\u2600\uFE0F"
    if (code <= 3) return "\u26C5"
    if (code <= 48) return "\uD83C\uDF2B\uFE0F"
    if (code <= 57) return "\uD83C\uDF27\uFE0F"
    if (code <= 67) return "\uD83C\uDF27\uFE0F"
    if (code <= 77) return "\u2744\uFE0F"
    if (code <= 82) return "\uD83C\uDF26\uFE0F"
    if (code <= 86) return "\uD83C\uDF28\uFE0F"
    return "\u26C8\uFE0F"
  }

  // ── Journal state ──
  let journalDate = $state("")
  let journalEntry = $state<any>(null)
  let journalLoading = $state(false)
  let journalTab = $state<"morning" | "evening" | "trainer">("morning")
  let yesterdayIntention = $state<string | null>(null)
  let dayCheck = $state<{ habits: string[]; workouts: string[]; meals: string[] } | null>(null)
  const hasUnfinished = $derived(
    !!dayCheck && dayCheck.habits.length + dayCheck.workouts.length + dayCheck.meals.length > 0,
  )
  let weatherRefreshing = $state(false)

  // Journal field states
  let jBodyWeight = $state("")
  let jWaistInches = $state("")
  let jSleepDuration = $state("")
  let jSleepQuality = $state<number | null>(null)
  let jMorningNotes = $state<string | null>(null)
  let jMood = $state<number | null>(null)
  let jEnergy = $state<number | null>(null)
  let jHighlights = $state("")
  let jChallenges = $state("")
  let jIntention = $state("")
  let jDayRating = $state<number | null>(null)
  let jEveningNotes = $state<string | null>(null)

  const todayStr = $derived(localToday(tz))
  const isJournalFuture = $derived(journalDate > todayStr)

  function syncJournalFields(entry: any) {
    if (!entry) {
      jBodyWeight = ""
      jWaistInches = ""
      jSleepDuration = ""
      jSleepQuality = null
      jMorningNotes = null
      jMood = null
      jEnergy = null
      jHighlights = ""
      jChallenges = ""
      jIntention = ""
      jDayRating = null
      jEveningNotes = null
      return
    }
    const m = entry.morning ?? {}
    const e = entry.evening ?? {}
    jBodyWeight = m.bodyWeight?.toString() ?? ""
    jWaistInches = m.waistInches?.toString() ?? ""
    jSleepDuration = m.sleepDuration?.toString() ?? ""
    jSleepQuality = m.sleepQuality ?? null
    jMorningNotes = m.notes ?? null
    jMood = e.mood ?? null
    jEnergy = e.energy ?? null
    jHighlights = e.highlights ?? ""
    jChallenges = e.challenges ?? ""
    jIntention = e.intention ?? ""
    jDayRating = e.dayRating ?? null
    jEveningNotes = e.notes ?? null

    // Auto-switch to evening tab if morning has been filled in
    const hasMorning = m.bodyWeight != null || m.waistInches != null || m.sleepDuration != null || m.sleepQuality != null || m.notes
    if (hasMorning && journalTab === "morning") journalTab = "evening"
  }

  async function loadJournalEntry() {
    if (!journey) return
    journalLoading = true
    const [entryRes, intentionRes, checkRes] = await Promise.all([
      fetch(`/api/journal?journeyId=${journey.id}&date=${journalDate}`),
      fetch(`/api/journal/yesterday-intention?journeyId=${journey.id}&date=${journalDate}`),
      fetch(`/api/journal/day-check?journeyId=${journey.id}&date=${journalDate}`),
    ])
    if (entryRes.ok) {
      const data = await entryRes.json()
      journalEntry = data
      syncJournalFields(data)
    }
    if (intentionRes.ok) {
      const data = await intentionRes.json()
      yesterdayIntention = data.intention
    }
    dayCheck = checkRes.ok ? await checkRes.json() : null
    journalLoading = false
  }

  $effect(() => {
    if (journey && activeTab === "journal") {
      if (!journalDate) journalDate = localToday(tz)
      loadJournalEntry()
    }
  })

  // Pure calendar arithmetic on YYYY-MM-DD; mixing local midnight with toISOString() skipped days east of UTC
  function shiftDateStr(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
  }

  function journalPrevDay() {
    journalDate = shiftDateStr(journalDate, -1)
  }

  function journalNextDay() {
    const next = shiftDateStr(journalDate, 1)
    if (next <= todayStr) {
      journalDate = next
    }
  }

  async function refreshWeather() {
    if (!journalEntry) return
    weatherRefreshing = true
    try {
      const res = await fetch("/api/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: journalEntry.id, date: journalEntry.date }),
      })
      if (res.ok) {
        const weather = await res.json()
        journalEntry = { ...journalEntry, weather }
      }
    } finally {
      weatherRefreshing = false
    }
  }

  async function ensureEntry(): Promise<any> {
    if (journalEntry) return journalEntry
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId: journey.id, date: journalDate }),
    })
    if (res.ok) {
      journalEntry = await res.json()
      syncJournalFields(journalEntry)
    }
    return journalEntry
  }

  async function saveMorningField(field: string, value: any) {
    const entry = await ensureEntry()
    if (!entry) return
    await fetch(`/api/journal/${entry.id}/morning`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
  }

  async function saveEveningField(field: string, value: any) {
    const entry = await ensureEntry()
    if (!entry) return
    await fetch(`/api/journal/${entry.id}/evening`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
  }

  function pct(current: number, target: number): number {
    if (!target) return 0
    return Math.min(100, Math.round((current / target) * 100))
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const WEEK_DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


</script>

<!-- Page header -->
<a href="/tabi" class="back-link">&larr; Journey</a>
<div class="journey-header">
  <div class="header-left">
    <h1 class="journey-title">{journey?.name ?? "Journey"}</h1>
    {#if journey?.description}
      <p class="journey-desc">{journey.description}</p>
    {/if}
  </div>
  {#if journey}
    <div class="journey-meta-right">
      <p class="journey-dates">
        {formatDateShort(journey.startDate, tz)} &mdash; {formatDateShort(journey.endDate, tz)}
      </p>
      <p class="journey-progress">
        Day {daysIn} of {totalDays} &middot; {daysLeft} days left &middot; {pctComplete}%
      </p>
    </div>
  {/if}
</div>

<!-- Ended banner -->
{#if isEnded && !isArchived}
  <div class="ended-banner">
    <span>This journey ended on {formatDate(journey.endDate, tz)}.</span>
  </div>
{/if}

{#if isArchived}
  <div class="ended-banner">
    <span>This journey has been archived.</span>
    <button class="btn-archive" onclick={unarchiveJourney}>Unarchive</button>
  </div>
{/if}

{#if showSettings}
  <SettingsTabs
    journeyId={journey.id}
    name={settingsName}
    description={settingsDesc}
    statement={settingsStatement}
    startDate={settingsStartDate}
    startTime={settingsStartTime}
    endDate={settingsEndDate}
    endTime={settingsEndTime}
    {tdee}
    {weightGoalLbsPerWeek}
    {targetWeight}
    {dailyCalorieOverride}
    {dailyCalorieTarget}
    {macroMode}
    {proteinValue}
    {carbsValue}
    {fatValue}
    {dailyWaterTargetOz}
    {mealPlanItems}
    {mealBuilds}
    {mealPlanFoods}
    {categories}
    {weeklyFastingHours}
    {allPlans}
    {selectedPlanIds}
    dojoSessionsPerWeek={dojoSessionsPerWeek}
    dojoWeeklyCalorieBurn={dojoWeeklyCalorieBurn}
    {workoutTypes}
    {allCommitments}
    {selectedCommitmentIds}
    {trainerKey}
    {trainerApiKeyDraft}
    {trainerModel}
    {trainerSystemPrompt}
    {trainerKickoffPrompt}
    onremovetrainerkey={removeTrainerKey}
    {saving}
    {saveError}
    {saveSuccess}
    {isArchived}
    onchange={handleSettingsChange}
    onsave={saveSettings}
    onclose={() => (showSettings = false)}
    onarchive={archiveJourney}
    onunarchive={unarchiveJourney}
    ondelete={deleteJourney}
  />
{:else}
  <!-- ════════════ TAB NAVIGATION ════════════ -->
  <nav class="tab-nav">
    <button class="tab" class:tab-active={activeTab === "overview"} onclick={() => (activeTab = "overview")}>
      Dashboard
    </button>
    <button class="tab" class:tab-active={activeTab === "journal"} onclick={() => (activeTab = "journal")}>
      Journal
    </button>
    <button class="tab" class:tab-active={activeTab === "progress"} onclick={() => (activeTab = "progress")}>
      Progress
    </button>
    <button class="tab" class:tab-active={activeTab === "guidance"} onclick={() => (activeTab = "guidance")}>
      Guidance
    </button>
    <button class="settings-link" onclick={() => (showSettings = true)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      Settings
    </button>
  </nav>

  {#snippet trendChart(
    range: { chartStart: Date; chartEnd: Date; totalMs: number },
    series: TrendSeries,
    unit: string,
    target: number | null,
  )}
    {@const cW = 600}
    {@const cH = 200}
    {@const cPad = { top: 20, right: 20, bottom: 34, left: 56 }}
    {@const plotW = cW - cPad.left - cPad.right}
    {@const plotH = cH - cPad.top - cPad.bottom}
    {@const xForDate = (d: Date) => cPad.left + (plotW * (d.getTime() - range.chartStart.getTime())) / range.totalMs}
    {@const yForValue = (v: number) => cPad.top + plotH - (plotH * (v - series.yMin)) / (series.yMax - series.yMin)}
    {@const tx1 = xForDate(new Date(series.trendStart.date + "T00:00:00"))}
    {@const ty1 = yForValue(series.trendStart.weight)}
    {@const tx2 = xForDate(new Date(series.trendEnd.date + "T00:00:00"))}
    {@const ty2 = yForValue(series.trendEnd.weight)}

    <svg class="weight-chart" viewBox="0 0 {cW} {cH}" preserveAspectRatio="xMidYMid meet">
      <!-- Y-axis gridlines and labels -->
      {#each Array(5) as _, i}
        {@const yVal = series.yMin + ((series.yMax - series.yMin) * (4 - i)) / 4}
        {@const y = cPad.top + (plotH * i) / 4}
        <line x1={cPad.left} y1={y} x2={cW - cPad.right} y2={y} class="chart-grid" />
        <text x={cPad.left - 6} y={y + 4} class="chart-label" text-anchor="end">{Math.round(yVal * 10) / 10}</text>
      {/each}

      <!-- X-axis labels -->
      <text x={xForDate(range.chartStart)} y={cH - 4} class="chart-label" text-anchor="start">
        {formatDateShort(range.chartStart.toISOString(), tz)}
      </text>
      <text x={xForDate(range.chartEnd)} y={cH - 4} class="chart-label" text-anchor="end">
        {formatDateShort(range.chartEnd.toISOString(), tz)}
      </text>

      <!-- Target reference line -->
      {#if target != null}
        {@const yTarget = yForValue(target)}
        <line x1={cPad.left} y1={yTarget} x2={cW - cPad.right} y2={yTarget} class="chart-line-target" />
        <text x={cW - cPad.right} y={yTarget - 6} class="chart-label-goal" text-anchor="end">Target</text>
      {/if}

      <!-- Actual line -->
      {#if series.entries.length >= 2}
        <polyline
          fill="none"
          class="chart-line-actual"
          points={series.entries.map((e) => `${xForDate(new Date(e.date + "T00:00:00"))},${yForValue(e.weight)}`).join(" ")}
        />
      {/if}

      <!-- Actual dots -->
      {#each series.entries as e}
        {@const x = xForDate(new Date(e.date + "T00:00:00"))}
        {@const y = yForValue(e.weight)}
        <circle cx={x} cy={y} r="8" class="chart-dot-hit" use:tooltip={weightDotTooltip(e.date, e.weight, unit)} />
        <circle cx={x} cy={y} r="3" class="chart-dot" />
      {/each}

      <!-- Linear trend line -->
      <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} class="chart-line-trend" />
    </svg>
  {/snippet}

  <!-- Pace axis is inverted: faster (lower) pace plots higher, so improvement trends upward -->
  {#snippet paceChart(chart: NonNullable<typeof runningChart>)}
    {@const cW = 600}
    {@const cH = 200}
    {@const cPad = { top: 20, right: 20, bottom: 34, left: 56 }}
    {@const plotW = cW - cPad.left - cPad.right}
    {@const plotH = cH - cPad.top - cPad.bottom}
    {@const xForWeek = (i: number) => cPad.left + (plotW * (i + 0.5)) / chart.weeks.length}
    {@const yForPace = (p: number) => cPad.top + (plotH * (p - chart.yMin)) / (chart.yMax - chart.yMin)}

    <svg class="weight-chart" viewBox="0 0 {cW} {cH}" preserveAspectRatio="xMidYMid meet">
      {#each Array(5) as _, i}
        {@const pVal = chart.yMin + ((chart.yMax - chart.yMin) * i) / 4}
        {@const y = cPad.top + (plotH * i) / 4}
        <line x1={cPad.left} y1={y} x2={cW - cPad.right} y2={y} class="chart-grid" />
        <text x={cPad.left - 6} y={y + 4} class="chart-label" text-anchor="end">{formatPace(pVal, false)}</text>
      {/each}

      <text x={cPad.left} y={cH - 4} class="chart-label" text-anchor="start">{formatDateShort(chart.weeks[0].weekStart, tz)}</text>
      <text x={cW - cPad.right} y={cH - 4} class="chart-label" text-anchor="end">{formatDateShort(chart.weeks[chart.weeks.length - 1].weekStart, tz)}</text>

      {#if chart.paced.length >= 2}
        <polyline fill="none" class="chart-line-actual" points={chart.paced.map((w) => `${xForWeek(w.i)},${yForPace(w.avgPace)}`).join(" ")} />
      {/if}

      {#each chart.paced as w}
        {@const x = xForWeek(w.i)}
        {@const y = yForPace(w.avgPace)}
        <circle cx={x} cy={y} r="8" class="chart-dot-hit" use:tooltip={runWeekTooltip(w)} />
        <circle cx={x} cy={y} r="3" class="chart-dot" />
      {/each}

      {#if chart.trend}
        <line x1={xForWeek(chart.trend.x1)} y1={yForPace(chart.trend.y1)} x2={xForWeek(chart.trend.x2)} y2={yForPace(chart.trend.y2)} class="chart-line-trend" />
      {/if}
    </svg>
  {/snippet}

  {#snippet milesChart(chart: NonNullable<typeof runningChart>)}
    {@const cW = 600}
    {@const cH = 140}
    {@const cPad = { top: 16, right: 20, bottom: 34, left: 56 }}
    {@const plotW = cW - cPad.left - cPad.right}
    {@const plotH = cH - cPad.top - cPad.bottom}
    {@const slotW = plotW / chart.weeks.length}
    {@const barW = Math.max(Math.min(slotW * 0.6, 40), 2)}

    <svg class="weight-chart" viewBox="0 0 {cW} {cH}" preserveAspectRatio="xMidYMid meet">
      {#each [1, 0.5, 0] as frac}
        {@const y = cPad.top + plotH * (1 - frac)}
        <line x1={cPad.left} y1={y} x2={cW - cPad.right} y2={y} class="chart-grid" />
        <text x={cPad.left - 6} y={y + 4} class="chart-label" text-anchor="end">{Math.round(chart.maxMiles * frac * 10) / 10}</text>
      {/each}

      {#each chart.weeks as w, i}
        {@const h = (plotH * w.miles) / chart.maxMiles}
        {@const x = cPad.left + slotW * (i + 0.5) - barW / 2}
        <rect x={x} y={cPad.top + plotH - h} width={barW} height={h} rx="2" class="chart-bar" />
        <rect x={cPad.left + slotW * i} y={cPad.top} width={slotW} height={plotH} class="chart-dot-hit" use:tooltip={runWeekTooltip(w)} />
      {/each}

      <text x={cPad.left} y={cH - 4} class="chart-label" text-anchor="start">{formatDateShort(chart.weeks[0].weekStart, tz)}</text>
      <text x={cW - cPad.right} y={cH - 4} class="chart-label" text-anchor="end">{formatDateShort(chart.weeks[chart.weeks.length - 1].weekStart, tz)}</text>
    </svg>
  {/snippet}

  <!-- ════════════ OVERVIEW TAB ════════════ -->
  {#if activeTab === "overview"}
    {#if !hasAnyTargets}
      <div class="empty-overview">
        <Card>
          <div class="empty-content">
            <p class="empty-message">
              Your journey has no targets yet — open settings to get started.
            </p>
            <Button onclick={() => (showSettings = true)}>Open settings</Button>
          </div>
        </Card>
      </div>
    {:else if overviewLoading}
      <p class="loading-text">Loading...</p>
    {:else if overviewData}
      <div class="widget-grid">
        {#each visibleWidgets as id (id)}
        <div class="widget-slot" class:widget-dragging={draggingWidget === id} data-widget-id={id} animate:flip={{ duration: 200 }}>
          {#if id === "shoku"}
          <DashboardWidget
            title="Nutrition"
            icon={icons.shoku}
            collapsed={collapsedWidgets.includes(id)}
            onToggle={() => toggleWidget(id)}
            onDragStart={(e) => startWidgetDrag(id, e)}
            onDragMove={dragWidget}
            onDragEnd={endWidgetDrag}
            onMove={(dir) => nudgeWidget(id, dir)}
          >
            {#snippet headerExtra()}
              <a href="/shoku" class="widget-link">View &rarr;</a>
            {/snippet}
              {@const shoku = overviewData.shoku}
              {@const targets = journey.shokuTargets}

              {#if targets.dailyCalorieTarget}
                {@const remaining = targets.dailyCalorieTarget - shoku.totals.calories + (shoku.caloriesBurnedToday ?? 0)}
                {@const remainingPercent = targets.dailyCalorieTarget > 0
                  ? Math.min(100, Math.max(0, ((shoku.totals.calories - (shoku.caloriesBurnedToday ?? 0)) / targets.dailyCalorieTarget) * 100))
                  : 0}
                {@const isOver = remaining < 0}
                <div class="widget-remaining">
                  <RadialProgress percent={remainingPercent} over={isOver} size={80} strokeWidth={7}>
                    <span class="remaining-value">{Math.round(remaining)}</span>
                    <span class="remaining-caption">left</span>
                  </RadialProgress>
                  <div class="remaining-rows">
                    <div class="remaining-row"><span class="stat-label">Base Goal</span><span class="stat-values">{targets.dailyCalorieTarget} kcal</span></div>
                    <div class="remaining-row"><span class="stat-label">Food</span><span class="stat-values">{Math.round(shoku.totals.calories)} kcal</span></div>
                    <div class="remaining-row"><span class="stat-label">Exercise</span><span class="stat-values">{Math.round(shoku.caloriesBurnedToday ?? 0)} kcal</span></div>
                  </div>
                </div>

                <div class="widget-stat">
                  <div class="stat-header">
                    <span class="stat-label">Calories</span>
                    <span class="stat-values">{Math.round(shoku.totals.calories)} / {targets.dailyCalorieTarget} kcal</span>
                  </div>
                  <ProgressBar value={pct(shoku.totals.calories, targets.dailyCalorieTarget)} />
                </div>
              {/if}

              {#if targets.macros}
                {@const calTarget = targets.dailyCalorieTarget ?? 2000}
                {#each [
                  { label: "Protein", current: shoku.totals.protein, macro: targets.macros.protein, calPerGram: 4 },
                  { label: "Carbs", current: shoku.totals.carbs, macro: targets.macros.carbs, calPerGram: 4 },
                  { label: "Fat", current: shoku.totals.fat, macro: targets.macros.fat, calPerGram: 9 },
                ] as m}
                  {@const targetGrams = m.macro?.grams ?? (m.macro?.percentage ? Math.round((calTarget * (m.macro.percentage / 100)) / m.calPerGram) : null)}
                  {#if targetGrams}
                    <div class="widget-stat">
                      <div class="stat-header">
                        <span class="stat-label">{m.label}</span>
                        <span class="stat-values">{Math.round(m.current)}g / {targetGrams}g</span>
                      </div>
                      <ProgressBar value={pct(m.current, targetGrams)} />
                    </div>
                  {/if}
                {/each}
              {/if}

              {#if targets.dailyWaterTargetOz}
                <div class="widget-stat">
                  <div class="stat-header">
                    <span class="stat-label">Water</span>
                    <span class="stat-values">{shoku.waterOz} / {targets.dailyWaterTargetOz} oz</span>
                  </div>
                  <ProgressBar value={pct(shoku.waterOz, targets.dailyWaterTargetOz)} />
                </div>
              {/if}
          </DashboardWidget>
          {:else if id === "weight"}
          <DashboardWidget
            title="Weight"
            icon={WEIGHT_ICON}
            collapsed={collapsedWidgets.includes(id)}
            onToggle={() => toggleWidget(id)}
            onDragStart={(e) => startWidgetDrag(id, e)}
            onDragMove={dragWidget}
            onDragEnd={endWidgetDrag}
            onMove={(dir) => nudgeWidget(id, dir)}
          >
            {#snippet headerExtra()}
              <div class="weight-range-toggle">
              <button
                type="button"
                class="weight-range-btn"
                class:weight-range-btn-active={weightCardRange === "week"}
                onclick={() => (weightCardRange = "week")}
              >
                Week
              </button>
              <button
                type="button"
                class="weight-range-btn"
                class:weight-range-btn-active={weightCardRange === "month"}
                onclick={() => (weightCardRange = "month")}
              >
                Month
              </button>
              <button
                type="button"
                class="weight-range-btn"
                class:weight-range-btn-active={weightCardRange === "all"}
                onclick={() => (weightCardRange = "all")}
              >
                All
              </button>
            </div>
            {/snippet}
              {@const wp = weightProgressCard!}

              <div class="remaining-rows">
                <div class="remaining-row"><span class="stat-label">Current</span><span class="stat-values">{wp.currentWeight != null ? `${wp.currentWeight} lbs` : "—"}</span></div>
                <div class="remaining-row"><span class="stat-label">Target</span><span class="stat-values">{wp.targetWeight} lbs</span></div>
                <div class="remaining-row"><span class="stat-label">Waist</span><span class="stat-values">{wp.currentWaist != null ? `${wp.currentWaist} in` : "—"}</span></div>
              </div>

              {#if wp.hasEntries}
                {#if wp.weight}
                  {@render trendChart(wp, wp.weight, "lbs", wp.targetWeight)}
                {/if}
                {#if wp.waist}
                  <span class="stat-label weight-chart-caption">Waist (in)</span>
                  {@render trendChart(wp, wp.waist, "in", null)}
                {/if}
              {:else}
                <p class="widget-text">Log your weight and waist in today's journal check-in to start tracking progress.</p>
              {/if}
          </DashboardWidget>
          {:else if id === "kata"}
          <DashboardWidget
            title="Habits"
            icon={icons.kata}
            collapsed={collapsedWidgets.includes(id)}
            onToggle={() => toggleWidget(id)}
            onDragStart={(e) => startWidgetDrag(id, e)}
            onDragMove={dragWidget}
            onDragEnd={endWidgetDrag}
            onMove={(dir) => nudgeWidget(id, dir)}
          >
            {#snippet headerExtra()}
              <a href="/kata" class="widget-link">View &rarr;</a>
            {/snippet}
              {@const kata = overviewData.kata}

              {#if kata.dailyCommitments?.length > 0}
                <div class="widget-subsection-label">Today</div>
                {#each kata.dailyCommitments as commitment}
                  <div class="widget-stat">
                    <div class="stat-header">
                      <span class="stat-label">{commitment.name}</span>
                      <span class="stat-values">
                        {commitment.progress.current}{commitment.unit ? ` ${commitment.unit}` : ""} / {commitment.progress.target}
                      </span>
                    </div>
                    <ProgressBar value={commitment.progress.percentage} />
                  </div>
                {/each}
              {/if}

              {#if kata.otherCommitments?.length > 0}
                <div class="widget-subsection-label">Ongoing</div>
                {#each kata.otherCommitments as commitment}
                  <div class="widget-stat">
                    <div class="stat-header">
                      <span class="stat-label">{commitment.name}</span>
                      <span class="stat-values">
                        {commitment.progress.current}{commitment.unit ? ` ${commitment.unit}` : ""} / {commitment.progress.target}
                      </span>
                    </div>
                    <ProgressBar value={commitment.progress.percentage} />
                  </div>
                {/each}
              {/if}
          </DashboardWidget>
          {:else if id === "dojo"}
          <DashboardWidget
            title="Workout"
            icon={icons.dojo}
            collapsed={collapsedWidgets.includes(id)}
            onToggle={() => toggleWidget(id)}
            onDragStart={(e) => startWidgetDrag(id, e)}
            onDragMove={dragWidget}
            onDragEnd={endWidgetDrag}
            onMove={(dir) => nudgeWidget(id, dir)}
          >
            {#snippet headerExtra()}
              <a href="/dojo" class="widget-link">View &rarr;</a>
            {/snippet}
              {@const dojo = overviewData.dojo}
              {@const targets = journey.dojoTargets}

              {#if targets.sessionsPerWeek}
                <div class="widget-stat">
                  <div class="stat-header">
                    <span class="stat-label">Sessions this week</span>
                    <span class="stat-values">{dojo.sessionsThisWeek} / {targets.sessionsPerWeek}</span>
                  </div>
                  <ProgressBar value={pct(dojo.sessionsThisWeek, targets.sessionsPerWeek)} />
                </div>
              {/if}

              {#if targets.weeklyCalorieBurn}
                <div class="widget-stat">
                  <div class="stat-header">
                    <span class="stat-label">Calories burned</span>
                    <span class="stat-values">{dojo.weeklyCaloriesBurned} / {targets.weeklyCalorieBurn} kcal</span>
                  </div>
                  <ProgressBar value={pct(dojo.weeklyCaloriesBurned, targets.weeklyCalorieBurn)} />
                </div>
              {/if}

              {#if dojo.upcomingSessions.length > 0}
                <div class="upcoming-sessions">
                  <span class="field-label">Upcoming</span>
                  {#each dojo.upcomingSessions as session}
                    <div class="upcoming-row" class:upcoming-completed={session.completed}>
                      <span class="upcoming-day">
                        {session.targetDay != null ? DAY_NAMES[session.targetDay] : "Unscheduled"}
                      </span>
                      <span class="upcoming-name">{session.planName} — {session.sessionName}</span>
                    </div>
                  {/each}
                </div>
              {/if}
          </DashboardWidget>
          {:else if id === "running"}
          <DashboardWidget
            title="Running"
            icon={icons.running}
            collapsed={collapsedWidgets.includes(id)}
            onToggle={() => toggleWidget(id)}
            onDragStart={(e) => startWidgetDrag(id, e)}
            onDragMove={dragWidget}
            onDragEnd={endWidgetDrag}
            onMove={(dir) => nudgeWidget(id, dir)}
          >
            {#snippet headerExtra()}
              <a href="/dojo" class="widget-link">View &rarr;</a>
            {/snippet}
              {@const run = overviewData.running}
              {#if run.summary.totalRuns === 0}
                <p class="widget-text">No runs with distance logged in this journey yet.</p>
              {:else}
                {@const tw = run.thisWeek}
                {@const lw = run.lastWeek}
                {@const milesDelta = Math.round((tw.miles - lw.miles) * 100) / 100}
                {@const paceDelta = tw.avgPace != null && lw.avgPace != null ? tw.avgPace - lw.avgPace : null}
                <div class="remaining-rows">
                  <div class="remaining-row"><span class="stat-label">Runs</span><span class="stat-values">{run.summary.totalRuns}</span></div>
                  <div class="remaining-row"><span class="stat-label">Miles</span><span class="stat-values">{run.summary.totalMiles} mi</span></div>
                  <div class="remaining-row"><span class="stat-label">Avg pace</span><span class="stat-values">{formatPace(run.summary.avgPace, false)} /mi</span></div>
                  <div class="remaining-row"><span class="stat-label">Best pace</span><span class="stat-values">{formatPace(run.summary.bestPace, false)} /mi</span></div>
                  <div class="remaining-row"><span class="stat-label">Longest</span><span class="stat-values">{run.summary.longestRun} mi</span></div>
                </div>

                <div class="remaining-rows run-weeks">
                  <div class="remaining-row"><span class="stat-label">This week</span><span class="stat-values">{tw.miles} mi · {formatPace(tw.avgPace, false)} /mi</span></div>
                  <div class="remaining-row"><span class="stat-label">Last week</span><span class="stat-values">{lw.miles} mi · {formatPace(lw.avgPace, false)} /mi</span></div>
                  <div class="remaining-row">
                    <span class="stat-label">Change</span>
                    <span class="stat-values">
                      <span class:delta-good={milesDelta > 0} class:delta-bad={milesDelta < 0}>
                        {milesDelta > 0 ? "▲" : milesDelta < 0 ? "▼" : ""} {Math.abs(milesDelta)} mi
                      </span>
                      {#if paceDelta != null && Math.round(Math.abs(paceDelta) * 60) > 0}
                        · <span class:delta-good={paceDelta < 0} class:delta-bad={paceDelta > 0}>
                          {paceDelta < 0 ? "▲" : "▼"} {formatPace(Math.abs(paceDelta), false)} {paceDelta < 0 ? "faster" : "slower"}
                        </span>
                      {/if}
                    </span>
                  </div>
                </div>

                {#if runningChart}
                  {#if runningChart.paced.length > 0}
                    <span class="stat-label weight-chart-caption">Weekly pace (min/mi, faster is higher)</span>
                    {@render paceChart(runningChart)}
                  {/if}
                  <span class="stat-label weight-chart-caption">Weekly miles</span>
                  {@render milesChart(runningChart)}
                {/if}
              {/if}
          </DashboardWidget>
          {:else if id === "danjiki"}
          <DashboardWidget
            title="Fasting"
            icon={icons.danjiki}
            collapsed={collapsedWidgets.includes(id)}
            onToggle={() => toggleWidget(id)}
            onDragStart={(e) => startWidgetDrag(id, e)}
            onDragMove={dragWidget}
            onDragEnd={endWidgetDrag}
            onMove={(dir) => nudgeWidget(id, dir)}
          >
            {#snippet headerExtra()}
              <a href="/danjiki" class="widget-link">View &rarr;</a>
            {/snippet}
              {@const danjiki = overviewData.danjiki}
              {@const target = journey.danjikiTargets.weeklyFastingHours}

              {#if target}
                <div class="widget-stat">
                  <div class="stat-header">
                    <span class="stat-label">Weekly fasting</span>
                    <span class="stat-values">{danjiki.weeklyHoursFasted}h / {target}h</span>
                  </div>
                  <ProgressBar value={pct(danjiki.weeklyHoursFasted, target)} />
                </div>
              {:else}
                <p class="widget-text">{danjiki.weeklyHoursFasted}h fasted this week</p>
              {/if}

              {#if danjiki.activeFast}
                {@const elapsed = Math.round((Date.now() - new Date(danjiki.activeFast.startedAt).getTime()) / 3600000 * 10) / 10}
                <div class="active-fast">
                  <span class="active-fast-badge">Active fast</span>
                  <span>{elapsed}h elapsed of {danjiki.activeFast.targetDuration}h target</span>
                </div>
              {/if}
          </DashboardWidget>
          {/if}
        </div>
        {/each}
      </div>
    {/if}

  <!-- ════════════ JOURNAL TAB ════════════ -->
  {:else if activeTab === "journal"}
    <div class="journal-section">
      <!-- Date switcher + yesterday's intention -->
      <section class="date-nav">
        <div class="date-controls">
          <button class="date-btn" onclick={journalPrevDay}>&larr;</button>
          <input
            type="date"
            class="date-input"
            value={journalDate}
            max={todayStr}
            onchange={e => { journalDate = (e.target as HTMLInputElement).value }}
          />
          <button class="date-btn" onclick={journalNextDay} disabled={journalDate >= todayStr}>&rarr;</button>
        </div>
        {#if yesterdayIntention}
          <div class="intention-hint">
            <span class="intention-label">Today's Intentions</span>
            <span class="intention-text">{yesterdayIntention}</span>
          </div>
        {/if}
      </section>

      {#if journalLoading}
        <p class="loading-text">Loading...</p>
      {:else}
        {#if journalEntry}
          {#if journalEntry?.weather}
            <div class="journal-weather">
              <span class="weather-icon">{weatherIcon(journalEntry.weather.weatherCode)}</span>
              <span class="weather-temps">{journalEntry.weather.temperatureMax}° / {journalEntry.weather.temperatureMin}°F</span>
              <span class="weather-label">{journalEntry.weather.weatherLabel}</span>
              {#if journalEntry.weather.precipitation > 0}
                <span class="weather-precip">{journalEntry.weather.precipitation}mm</span>
              {/if}
            </div>
          {:else}
            <div class="journal-weather">
              <button class="weather-fetch-btn" onclick={refreshWeather} disabled={weatherRefreshing}>
                {weatherRefreshing ? "Fetching…" : "Get weather"}
              </button>
            </div>
          {/if}
        {/if}

        <!-- Morning / Evening / Trainer tab toggle -->
        <nav class="journal-tabs">
          <button class="journal-tab" class:journal-tab-active={journalTab === "morning"} onclick={() => (journalTab = "morning")}>
            Morning
          </button>
          <button class="journal-tab" class:journal-tab-active={journalTab === "evening"} onclick={() => (journalTab = "evening")}>
            Evening
          </button>
          <button class="journal-tab" class:journal-tab-active={journalTab === "trainer"} onclick={() => (journalTab = "trainer")}>
            Your Trainer
          </button>
        </nav>

        {#if journalTab === "trainer"}
          <TrainerChat journeyId={journey.id} date={journalDate} isToday={journalDate === todayStr} />
        {:else if !journalEntry}
          <!-- Empty state -->
          <Card>
            <div class="journal-empty">
              <p class="empty-message">No entry for this day. Start your morning check-in or evening reflection.</p>
              <div class="journal-empty-actions">
                <Button onclick={async () => { await ensureEntry(); journalTab = "morning" }}>Start Morning</Button>
                <Button variant="secondary" onclick={async () => { await ensureEntry(); journalTab = "evening" }}>Start Evening</Button>
              </div>
            </div>
          </Card>
        {:else if journalTab === "morning"}
          <div class="journal-form">
            <div class="journal-field">
              <label class="field-label" for="j-weight">Body weight (lbs)</label>
              <input
                id="j-weight"
                type="number"
                step="any"
                bind:value={jBodyWeight}
                placeholder="Optional"
                onblur={() => saveMorningField("bodyWeight", jBodyWeight ? Number(jBodyWeight) : null)}
              />
            </div>

            <div class="journal-field">
              <label class="field-label" for="j-waist">Waist (inches)</label>
              <input
                id="j-waist"
                type="number"
                step="any"
                bind:value={jWaistInches}
                placeholder="Optional"
                onblur={() => saveMorningField("waistInches", jWaistInches ? Number(jWaistInches) : null)}
              />
            </div>

            <div class="journal-field">
              <label class="field-label" for="j-sleep">Sleep duration (hours)</label>
              <input
                id="j-sleep"
                type="number"
                step="any"
                bind:value={jSleepDuration}
                placeholder="e.g. 7.5"
                onblur={() => saveMorningField("sleepDuration", jSleepDuration ? Number(jSleepDuration) : null)}
              />
            </div>

            <div class="journal-field">
              <span class="field-label">Sleep quality</span>
              <StarRating
                value={jSleepQuality}
                onchange={(v) => { jSleepQuality = v; saveMorningField("sleepQuality", v) }}
              />
            </div>

            <div class="journal-field">
              <span class="field-label">Morning notes</span>
              <TipTapEditor
                content={jMorningNotes}
                onblur={(html) => { jMorningNotes = html; saveMorningField("notes", html) }}
                placeholder="How are you feeling this morning..."
              />
            </div>
          </div>

        {:else}
          <div class="journal-form">
            {#if hasUnfinished && dayCheck}
              <div class="day-check">
                <span class="day-check-label">Unfinished business</span>
                <ul class="day-check-list">
                  {#if dayCheck.habits.length > 0}
                    <li>Unchecked habits: {dayCheck.habits.join(", ")}</li>
                  {/if}
                  {#if dayCheck.workouts.length > 0}
                    <li>Workouts not recorded: {dayCheck.workouts.join(", ")}</li>
                  {/if}
                  {#if dayCheck.meals.length > 0}
                    <li>No food logged for {dayCheck.meals.join(", ")}</li>
                  {/if}
                </ul>
              </div>
            {/if}

            <div class="journal-field">
              <span class="field-label">Mood</span>
              <StarRating
                value={jMood}
                onchange={(v) => { jMood = v; saveEveningField("mood", v) }}
              />
            </div>

            <div class="journal-field">
              <span class="field-label">Energy</span>
              <StarRating
                value={jEnergy}
                onchange={(v) => { jEnergy = v; saveEveningField("energy", v) }}
              />
            </div>

            <div class="journal-field">
              <label class="field-label" for="j-highlights">Highlights</label>
              <input
                id="j-highlights"
                type="text"
                bind:value={jHighlights}
                placeholder="What went well today"
                onblur={() => saveEveningField("highlights", jHighlights || null)}
              />
            </div>

            <div class="journal-field">
              <label class="field-label" for="j-challenges">Challenges</label>
              <input
                id="j-challenges"
                type="text"
                bind:value={jChallenges}
                placeholder="What was difficult"
                onblur={() => saveEveningField("challenges", jChallenges || null)}
              />
            </div>

            <div class="journal-field">
              <label class="field-label" for="j-intention">Intention for tomorrow</label>
              <input
                id="j-intention"
                type="text"
                bind:value={jIntention}
                placeholder="One thing you intend to do"
                onblur={() => saveEveningField("intention", jIntention || null)}
              />
            </div>

            <div class="journal-field">
              <span class="field-label">Evening notes</span>
              <TipTapEditor
                content={jEveningNotes}
                onblur={(html) => { jEveningNotes = html; saveEveningField("notes", html) }}
                placeholder="Reflect on your day..."
              />
            </div>

            <div class="journal-field">
              <span class="field-label">Day rating</span>
              <DotRating
                value={jDayRating}
                onchange={(v) => { jDayRating = v; saveEveningField("dayRating", v) }}
              />
            </div>
          </div>
        {/if}
      {/if}
    </div>

  <!-- ════════════ PROGRESS TAB ════════════ -->
  {:else if activeTab === "progress"}
    <div class="progress-layout" class:progress-sidebar-collapsed={!progressSidebarOpen}>
      <!-- Left: Calendar -->
      <div class="progress-main">
        <Card>
          <div class="calendar-widget">
            <div class="calendar-header">
              <div class="calendar-nav">
                <button class="date-btn" onclick={calendarPrev} aria-label="Previous">&larr;</button>
                <span class="calendar-month-label">{calendarHeaderLabel}</span>
                <button class="date-btn" onclick={calendarNext} aria-label="Next">&rarr;</button>
              </div>
              <div class="calendar-view-toggle">
                <button
                  type="button"
                  class="calendar-view-btn"
                  class:calendar-view-btn-active={calendarViewMode === "week"}
                  onclick={() => (calendarViewMode = "week")}
                >
                  Week
                </button>
                <button
                  type="button"
                  class="calendar-view-btn"
                  class:calendar-view-btn-active={calendarViewMode === "month"}
                  onclick={() => (calendarViewMode = "month")}
                >
                  Month
                </button>
              </div>
            </div>
            <div class="calendar-grid" class:calendar-grid-week={calendarViewMode === "week"}>
              <div class="calendar-row calendar-row-header">
                {#each WEEK_DOW as dow}
                  <div class="calendar-dow">{dow}</div>
                {/each}
                <div class="calendar-dow calendar-dow-summary"></div>
              </div>
              {#each calendarRows as row}
                <div class="calendar-row" class:calendar-row-alt={row.weekIndex % 2 === 1}>
                  {#each row.days as cell, i}
                    {@const dd = dayData(cell.dateStr)}
                    <div
                      class="calendar-cell"
                      class:calendar-cell-outside={cell.outside}
                      class:calendar-cell-today={cell.dateStr === calendarToday}
                      class:calendar-cell-active={dd}
                      onclick={() => { if (dd) selectedDay = cell.dateStr }}
                      role={dd ? "button" : undefined}
                      tabindex={dd ? 0 : undefined}
                      onkeydown={(e) => { if (dd && (e.key === "Enter" || e.key === " ")) selectedDay = cell.dateStr }}
                    >
                      <!-- Top-left: day name (mobile week view) + day number -->
                      <span class="calendar-day-number"><span class="cal-dow-label">{WEEK_DOW[i]}</span>{cell.day}</span>
                      <!-- Top-center: weather -->
                      {#if dd?.weather}
                        <span class="cal-weather">{weatherIcon(dd.weather.weatherCode)} {dd.weather.temperatureMax}°/{dd.weather.temperatureMin}°</span>
                      {/if}
                      <!-- Top-right: day rating -->
                      <div class="cal-rating">
                        {#if dd?.dayRating}
                          <div class="cal-dots">
                            {#each Array(5) as _, i}
                              <span class="cal-dot" class:cal-dot-filled={i < dd.dayRating}></span>
                              {/each}
                            </div>
                          {/if}
                        </div>
                        <!-- Bottom-left: stats -->
                        <div class="cal-stats">
                          {#if dd}
                            {#if dd.workouts?.length > 0}
                              {@const strengthVol = dd.workouts.filter((w: any) => w.type === "strength").reduce((s: number, w: any) => s + (w.totalVolume ?? 0), 0)}
                              {@const cardioW = dd.workouts.filter((w: any) => w.type === "cardio")}
                              {#if strengthVol > 0}
                                <div class="cal-stat-row">
                                  <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7"/><path d="M17.5 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7"/><rect x="9" y="9" width="6" height="2" rx="1"/><line x1="3" y1="10" x2="6.5" y2="10"/><line x1="17.5" y1="10" x2="21" y2="10"/></svg>
                                  <span class="cal-micro">{(strengthVol / 1000).toFixed(1)}k lbs</span>
                                </div>
                              {/if}
                              {#if cardioW.length > 0}
                                {@const dist = cardioW.reduce((s: number, w: any) => s + (w.cardioDistance ?? 0), 0)}
                                {#if dist > 0}
                                  <div class="cal-stat-row">
                                    <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M7 22l3-7 2.5 1V22"/><path d="M17 22l-3-7-2.5 1"/><path d="M10 11l-1 5 5.5 2"/><path d="M14 11l1 2-4 3"/></svg>
                                    <span class="cal-micro">{dist.toFixed(1)} mi</span>
                                  </div>
                                {/if}
                              {/if}
                            {/if}
                            {#if dd.fastCount > 0}
                              <div class="cal-stat-row">
                                <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                <span class="cal-micro">{dd.fastHours ? `${Math.round(dd.fastHours * 10) / 10}h` : ""}</span>
                              </div>
                            {/if}
                            {#if dd.caloriesBurned > 0}
                              <div class="cal-stat-row">
                                <svg class="cal-icon" style="color: var(--accent-red, #e74c3c)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c0-3 2.5-6 2.5-6s2.5 3 2.5 6a2.5 2.5 0 1 1-5 0Z"/><path d="M12 21a8 8 0 0 1-8-8c0-5 4-9 8-13 4 4 8 8 8 13a8 8 0 0 1-8 8Z"/></svg>
                                <span class="cal-micro">{dd.caloriesBurned} cal</span>
                              </div>
                            {/if}
                            {#if dd.netCalories != null && cell.dateStr !== calendarToday}
                              <div class="cal-stat-row">
                                <svg class="cal-icon" style="color: var(--accent-green, #2ecc71)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c0-3 2.5-6 2.5-6s2.5 3 2.5 6a2.5 2.5 0 1 1-5 0Z"/><path d="M12 21a8 8 0 0 1-8-8c0-5 4-9 8-13 4 4 8 8 8 13a8 8 0 0 1-8 8Z"/></svg>
                                <span class="cal-micro" class:cal-deficit={dd.netCalories < 0} class:cal-surplus={dd.netCalories > 0}>{dd.netCalories > 0 ? "+" : ""}{dd.netCalories} cal</span>
                              </div>
                            {/if}
                            {#if dd.weight}
                              <div class="cal-stat-row">
                                <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v17"/><path d="M5 8h14"/><path d="M3 21h18"/><circle cx="12" cy="3" r="1"/><path d="M5 8l-2 6a5 5 0 0 0 4 0l-2-6"/><path d="M19 8l-2 6a5 5 0 0 0 4 0l-2-6"/></svg>
                                <span class="cal-micro">{dd.weight} lbs</span>
                              </div>
                            {/if}
                          {/if}
                        </div>
                        <!-- Bottom-right: sticker for a completed Perfect / Outstanding day -->
                        {#if dd?.award?.tier}
                          <div class="cal-sticker">
                            <DaySticker
                              tier={dd.award.tier}
                              title={awardTooltip(dd.award.tier === "perfect" ? "Perfect day" : "Outstanding day", dd.award.goals)}
                            />
                          </div>
                        {/if}
                      </div>
                  {/each}
                  <div class="calendar-cell calendar-cell-summary">
                    {#if calendarWeeks[row.days[0].dateStr]?.medal}
                      {@const weekAward = calendarWeeks[row.days[0].dateStr]}
                      <div class="cal-medal">
                        <WeekMedal
                          medal={weekAward.medal}
                          title={awardTooltip(
                            `${weekAward.medal[0].toUpperCase()}${weekAward.medal.slice(1)} week · ${weekAward.stickerDays} sticker day${weekAward.stickerDays === 1 ? "" : "s"}`,
                            weekAward.targets,
                          )}
                        />
                      </div>
                    {/if}
                    {#if row.days.some((c) => calendarData[c.dateStr])}
                      {@const weekDays = row.days.map((c) => calendarData[c.dateStr]).filter(Boolean)}
                      {@const allWorkouts = weekDays.flatMap((d: any) => d.workouts ?? [])}
                      {@const weekVolume = allWorkouts.filter((w: any) => w.type === "strength").reduce((s: number, w: any) => s + (w.totalVolume ?? 0), 0)}
                      {@const weekStrengthDur = allWorkouts.filter((w: any) => w.type === "strength").reduce((s: number, w: any) => s + (w.durationMin ?? 0), 0)}
                      {@const weekCardioDist = allWorkouts.filter((w: any) => w.type === "cardio").reduce((s: number, w: any) => s + (w.cardioDistance ?? 0), 0)}
                      {@const weekCardioDur = allWorkouts.filter((w: any) => w.type === "cardio").reduce((s: number, w: any) => s + (w.durationMin ?? 0), 0)}
                      {@const ratedDays = weekDays.filter((d: any) => d.dayRating != null)}
                      {@const avgRating = ratedDays.length > 0 ? Math.round(ratedDays.reduce((s: number, d: any) => s + d.dayRating, 0) / ratedDays.length * 10) / 10 : null}
                      {#if weekVolume > 0}
                        <div class="cal-stat-row">
                          <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7"/><path d="M17.5 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7"/><rect x="9" y="9" width="6" height="2" rx="1"/><line x1="3" y1="10" x2="6.5" y2="10"/><line x1="17.5" y1="10" x2="21" y2="10"/></svg>
                          <span class="cal-micro">{(weekVolume / 1000).toFixed(1)}k lbs{weekStrengthDur > 0 ? ` · ${weekStrengthDur}m` : ""}</span>
                        </div>
                      {/if}
                      {#if weekCardioDist > 0 || weekCardioDur > 0}
                        <div class="cal-stat-row">
                          <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M7 22l3-7 2.5 1V22"/><path d="M17 22l-3-7-2.5 1"/><path d="M10 11l-1 5 5.5 2"/><path d="M14 11l1 2-4 3"/></svg>
                          <span class="cal-micro">{weekCardioDist > 0 ? `${weekCardioDist.toFixed(1)} mi` : ""}{weekCardioDist > 0 && weekCardioDur > 0 ? " · " : ""}{weekCardioDur > 0 ? `${weekCardioDur}m` : ""}</span>
                        </div>
                      {/if}
                      {@const weekCalsBurned = allWorkouts.reduce((s: number, w: any) => s + (w.caloriesBurned ?? 0), 0)}
                      {#if weekCalsBurned > 0}
                        <div class="cal-stat-row">
                          <svg class="cal-icon" style="color: var(--accent-red, #e74c3c)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c0-3 2.5-6 2.5-6s2.5 3 2.5 6a2.5 2.5 0 1 1-5 0Z"/><path d="M12 21a8 8 0 0 1-8-8c0-5 4-9 8-13 4 4 8 8 8 13a8 8 0 0 1-8 8Z"/></svg>
                          <span class="cal-micro">{weekCalsBurned} cal</span>
                        </div>
                      {/if}
                      {@const weekNetCals = weekDays.reduce((s: number, d: any) => s + (d.netCalories ?? 0), 0)}
                      {@const daysWithNet = weekDays.filter((d: any) => d.netCalories != null).length}
                      {#if daysWithNet > 0}
                        <div class="cal-stat-row">
                          <svg class="cal-icon" style="color: var(--accent-green, #2ecc71)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c0-3 2.5-6 2.5-6s2.5 3 2.5 6a2.5 2.5 0 1 1-5 0Z"/><path d="M12 21a8 8 0 0 1-8-8c0-5 4-9 8-13 4 4 8 8 8 13a8 8 0 0 1-8 8Z"/></svg>
                          <span class="cal-micro">{weekNetCals > 0 ? "+" : ""}{weekNetCals} cal</span>
                        </div>
                      {/if}
                      {#if avgRating != null}
                        <span class="cal-micro">Avg {avgRating}</span>
                      {/if}
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </Card>
      </div>

      <!-- Right: Widgets -->
      <div class="progress-sidebar">
        <button class="sidebar-toggle" onclick={() => (progressSidebarOpen = !progressSidebarOpen)} aria-label={progressSidebarOpen ? "Collapse widgets" : "Expand widgets"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            {#if progressSidebarOpen}
              <polyline points="9 18 15 12 9 6" />
            {:else}
              <polyline points="15 18 9 12 15 6" />
            {/if}
          </svg>
        </button>
        {#if progressSidebarOpen}
        {#if progressWeightChart}
          {@const wc = progressWeightChart}
          {@const cW = 600}
          {@const cH = 200}
          {@const cPad = { top: 20, right: 20, bottom: 34, left: 56 }}
          {@const plotW = cW - cPad.left - cPad.right}
          {@const plotH = cH - cPad.top - cPad.bottom}
          {@const xForDate = (d: Date) => cPad.left + (plotW * (d.getTime() - wc.chartStart.getTime())) / wc.totalMs}
          {@const yForWeight = (w: number) => cPad.top + plotH - (plotH * (w - wc.yMin)) / (wc.yMax - wc.yMin)}
          {@const todayDate = new Date(new Date().toISOString().split("T")[0] + "T00:00:00")}

          <Card>
            <div class="widget">
              <div class="widget-header">
                <h3 class="widget-title">
                  <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 3v18h18"/><polyline points="7 14 11 10 14 13 20 7"/>
                  </svg>
                  Weight
                </h3>
                <span class="stat-values">{wc.lastEntry.weight} lbs</span>
              </div>

              <svg class="weight-chart" viewBox="0 0 {cW} {cH}" preserveAspectRatio="xMidYMid meet">
                <!-- Y-axis gridlines and labels -->
                {#each Array(5) as _, i}
                  {@const yVal = wc.yMin + ((wc.yMax - wc.yMin) * (4 - i)) / 4}
                  {@const y = cPad.top + (plotH * i) / 4}
                  <line x1={cPad.left} y1={y} x2={cW - cPad.right} y2={y} class="chart-grid" />
                  <text x={cPad.left - 6} y={y + 4} class="chart-label" text-anchor="end">{Math.round(yVal * 10) / 10}</text>
                {/each}

                <!-- X-axis labels -->
                <text x={xForDate(wc.chartStart)} y={cH - 4} class="chart-label" text-anchor="start">
                  {wc.startLabel}
                </text>
                {#if todayDate.getTime() > wc.chartStart.getTime() && todayDate.getTime() < wc.chartEnd.getTime()}
                  <line x1={xForDate(todayDate)} y1={cPad.top} x2={xForDate(todayDate)} y2={cPad.top + plotH} class="chart-today" />
                  <text x={xForDate(todayDate)} y={cH - 4} class="chart-label" text-anchor="middle">Today</text>
                {/if}
                <text x={xForDate(wc.chartEnd)} y={cH - 4} class="chart-label" text-anchor="end">
                  {wc.endLabel}
                </text>

                <!-- Actual weight line -->
                {#if wc.entries.length >= 2}
                  <polyline
                    fill="none"
                    class="chart-line-actual"
                    points={wc.entries.map((e: {date: string, weight: number}) => {
                      const x = xForDate(new Date(e.date + "T00:00:00"))
                      const y = yForWeight(e.weight)
                      return `${x},${y}`
                    }).join(" ")}
                  />
                {/if}

                <!-- Actual weight dots -->
                {#each wc.entries as e}
                  {@const x = xForDate(new Date(e.date + "T00:00:00"))}
                  {@const y = yForWeight(e.weight)}
                  <circle cx={x} cy={y} r="8" class="chart-dot-hit" use:tooltip={weightDotTooltip(e.date, e.weight)} />
                  <circle cx={x} cy={y} r="3" class="chart-dot" />
                {/each}

                <!-- Projected line from last entry to goal -->
                {#if wc.goalWeightAtEnd != null}
                  {@const x1 = xForDate(new Date(wc.lastEntry.date + "T00:00:00"))}
                  {@const y1 = yForWeight(wc.lastEntry.weight)}
                  {@const x2 = xForDate(wc.chartEnd)}
                  {@const y2 = yForWeight(wc.goalWeightAtEnd)}
                  <line {x1} {y1} {x2} {y2} class="chart-line-projected" />
                  <circle cx={x2} cy={y2} r="4" class="chart-dot-goal" />
                  <text x={x2 - 6} y={y2 - 8} class="chart-label-goal" text-anchor="end">{Math.round(wc.goalWeightAtEnd * 10) / 10} lbs</text>
                {/if}
              </svg>
            </div>
          </Card>
        {/if}
        {/if}
      </div>
    </div>

    <!-- Day Detail Modal -->
    {#if selectedDay && dayData(selectedDay)}
      {@const sd = dayData(selectedDay)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div class="day-modal-overlay" onclick={() => (selectedDay = null)} role="dialog" aria-modal="true">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="day-modal" onclick={(e) => e.stopPropagation()}>
          <div class="day-modal-header">
            <span class="day-modal-date">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
            <button class="day-modal-close" onclick={() => (selectedDay = null)}>&times;</button>
          </div>

          <!-- Nutrition -->
          {#if sd.caloriesConsumed > 0 || sd.caloriesBurned > 0}
            <div class="day-section">
              <span class="day-section-title">Nutrition</span>
              <div class="day-section-content">
                {#if sd.caloriesConsumed > 0}
                  <span>+ {sd.caloriesConsumed} cal consumed</span>
                {/if}
                {#if calendarTdee != null}
                  <span>− {calendarTdee} cal TDEE</span>
                {/if}
                {#if sd.caloriesBurned > 0}
                  <span>− {sd.caloriesBurned} cal burned</span>
                {/if}
                {#if sd.netCalories != null}
                  <span class:cal-deficit={sd.netCalories < 0} class:cal-surplus={sd.netCalories > 0}>
                    = {sd.netCalories > 0 ? "+" : ""}{sd.netCalories} cal net
                  </span>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Workouts -->
          {#if sd.workouts?.length > 0}
            <div class="day-section">
              <span class="day-section-title">Workouts</span>
              <div class="day-section-content">
                {#each sd.workouts as w}
                  <a href="/dojo/session/{w.logId}" class="day-workout-row">
                    <span class="day-workout-name">{w.sessionName}</span>
                    {#if w.type === "strength" && w.totalVolume > 0}
                      <span class="day-workout-stat">{w.totalVolume.toLocaleString()} lbs</span>
                    {/if}
                    {#if w.type === "cardio" && w.cardioDistance}
                      <span class="day-workout-stat">{w.cardioDistance} mi</span>
                    {/if}
                    {#if w.caloriesBurned}
                      <span class="day-workout-stat">{w.caloriesBurned} cal</span>
                    {/if}
                    {#if w.hasPRs}
                      <span class="day-pr-badge">PR</span>
                    {/if}
                  </a>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Fast -->
          {#if sd.fastCount > 0}
            <div class="day-section">
              <span class="day-section-title">Fasting</span>
              <div class="day-section-content">
                <span>{sd.fastCount} fast{sd.fastCount !== 1 ? "s" : ""} — {Math.round(sd.fastHours * 10) / 10} hours</span>
              </div>
            </div>
          {/if}

          <!-- Commitments -->
          {#if sd.commitmentsTotal > 0}
            <div class="day-section">
              <span class="day-section-title">Commitments</span>
              <div class="day-section-content">
                <span>{sd.commitmentsMet} of {sd.commitmentsTotal} met</span>
              </div>
            </div>
          {/if}

          <!-- Journal -->
          {#if sd.dayRating != null || sd.mood != null || sd.energy != null}
            <div class="day-section">
              <span class="day-section-title">Journal</span>
              <div class="day-section-content">
                {#if sd.dayRating != null}
                  <div class="day-rating-row">
                    <span class="day-rating-label">Day</span>
                    <DotRating value={sd.dayRating} disabled />
                  </div>
                {/if}
                {#if sd.mood != null}
                  <div class="day-rating-row">
                    <span class="day-rating-label">Mood</span>
                    <StarRating value={sd.mood} disabled />
                  </div>
                {/if}
                {#if sd.energy != null}
                  <div class="day-rating-row">
                    <span class="day-rating-label">Energy</span>
                    <StarRating value={sd.energy} disabled />
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Weight -->
          {#if sd.weight || sd.waist}
            <div class="day-section">
              <span class="day-section-title">Weight</span>
              <div class="day-section-content">
                {#if sd.weight}<span>{sd.weight} lbs</span>{/if}
                {#if sd.waist}<span>{sd.waist} in waist</span>{/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {:else if activeTab === "guidance"}
    <div class="guidance">
      <div class="guidance-header">
        <p class="guidance-intro">
          A big-picture review of your whole journey: whether you're really hitting your targets, what's holding you
          back and what to change. Measured against why this journey matters to you.
        </p>
        {#if guidanceHasKey || guidanceTodayId}
          <Button onclick={requestGuidance} disabled={guidanceRequesting || guidanceLoading}>
            {guidanceRequesting ? "PREPARING…" : guidanceTodayId ? "VIEW TODAY'S GUIDANCE" : "GET GUIDANCE"}
          </Button>
        {/if}
      </div>

      {#if guidanceLoaded && !guidanceHasKey && !guidanceTodayId}
        <Card>
          <p class="guidance-muted">
            Guidance needs an Anthropic API key. Add one in <strong>Journey Settings → Trainer</strong>.
          </p>
        </Card>
      {/if}

      {#if guidanceError}
        <p class="guidance-error">{guidanceError}</p>
      {/if}

      {#if guidanceLoading && !guidanceLoaded}
        <p class="guidance-muted">Loading...</p>
      {:else if guidanceLoaded && guidanceList.length === 0}
        <p class="guidance-muted">No guidance yet.</p>
      {:else if guidanceList.length > 0}
        <ul class="guidance-list">
          {#each guidanceList as g (g.id)}
            <li>
              <a class="guidance-item" href={`/tabi/${journey.id}/guidance/${g.id}`}>
                <span class="guidance-date">{formatDate(g.requestedAt, tz)}</span>
                <span class="guidance-model">{trainerModelLabel(g.model)}</span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* ── Header ── */
  .journey-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-6);
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .back-link {
    display: inline-block;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-decoration: none;
    margin-bottom: var(--space-2);
    transition: color var(--transition-fast);
  }

  .back-link:hover {
    color: var(--ink);
  }

  .journey-title {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .journey-desc {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .journey-meta-right {
    text-align: right;
    margin-left: auto;
    flex-shrink: 0;
  }

  .journey-dates {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .journey-progress {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0.25rem 0 0;
  }

  .settings-link {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
    background: none;
    border: none;
    padding: var(--space-2) 0;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .settings-link:hover {
    color: var(--ink-light);
  }


  /* ── Ended banner ── */
  .ended-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--paper-warm);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-6);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .btn-archive {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-archive:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  /* ── Guidance tab ── */
  .guidance {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .guidance-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .guidance-intro,
  .guidance-muted {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
    max-width: 60ch;
  }

  .guidance-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-red);
    margin: 0;
  }

  .guidance-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--border);
  }

  .guidance-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: var(--ink);
    font-family: var(--font-body);
    font-size: var(--text-base);
    transition: color var(--transition-fast);
  }

  .guidance-item:hover {
    color: var(--accent);
  }

  .guidance-model {
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    color: var(--ink-faint);
  }

  @media (max-width: 640px) {
    .guidance-header {
      flex-direction: column;
      align-items: stretch;
    }
  }

  /* ── Tab navigation ── */
  .tab-nav {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-6);
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .tab:hover {
    color: var(--ink-light);
  }

  .tab-active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  /* ── Widget grid ── */
  .widget-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  @media (min-width: 768px) {
    .widget-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .widget-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .widget-icon {
    flex-shrink: 0;
  }

  .widget-slot {
    min-width: 0;
  }

  .widget-dragging {
    position: relative;
    z-index: 1;
    opacity: 0.85;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: var(--radius-md);
  }

  .run-weeks {
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .delta-good {
    color: var(--accent-green);
  }

  .delta-bad {
    color: var(--accent-red);
  }

  .chart-bar {
    fill: var(--ink);
    opacity: 0.7;
  }

  .widget-link {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .widget-link:hover {
    color: var(--accent);
  }

  .widget-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .widget-remaining {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border);
  }

  .remaining-rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  .remaining-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .remaining-value {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: var(--text-lg);
    color: var(--ink);
    line-height: 1.1;
  }

  .remaining-caption {
    font-family: var(--font-body);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .stat-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .widget-subsection-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .stat-values {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    font-variant-numeric: tabular-nums;
  }

  .widget-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .active-fast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .active-fast-badge {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: var(--space-1) var(--space-2);
    background: var(--accent-green-soft);
    color: var(--accent-green);
    border-radius: var(--radius-sm);
  }

  .upcoming-sessions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
  }

  .upcoming-row {
    display: flex;
    gap: var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .upcoming-day {
    color: var(--ink-faint);
    min-width: 80px;
    font-variant-numeric: tabular-nums;
  }

  .upcoming-name {
    color: var(--ink-light);
  }

  .upcoming-completed {
    text-decoration: line-through;
    opacity: 0.5;
  }

  /* ── Empty / placeholder ── */
  .empty-overview {
    max-width: 480px;
  }

  .empty-content {
    text-align: center;
    padding: var(--space-4);
  }

  .empty-message {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-light);
    margin-bottom: var(--space-6);
  }

  .loading-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  /* ── Weight chart ── */
  .weight-chart {
    width: 100%;
    height: auto;
  }

  .chart-grid {
    stroke: var(--border);
    stroke-width: 0.5;
  }

  .chart-label {
    font-family: var(--font-body);
    font-size: 12px;
    fill: var(--ink-faint);
  }

  .chart-today {
    stroke: var(--ink-faint);
    stroke-width: 0.5;
    stroke-dasharray: 4 3;
  }

  .chart-line-actual {
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .chart-dot {
    fill: var(--ink);
  }

  .chart-dot-hit {
    fill: transparent;
    cursor: pointer;
  }

  .chart-line-projected {
    stroke: var(--ink-faint);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
  }

  .chart-dot-goal {
    fill: none;
    stroke: var(--ink-faint);
    stroke-width: 1.5;
  }

  .chart-label-goal {
    font-family: var(--font-body);
    font-size: 12px;
    fill: var(--ink-faint);
    font-weight: 500;
  }

  .chart-line-target {
    stroke: var(--ink-faint);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .chart-line-trend {
    stroke: var(--accent, #2ecc71);
    stroke-width: 1.5;
    stroke-dasharray: 5 3;
  }

  .weight-chart-caption {
    display: block;
    margin-top: var(--space-3);
  }

  .weight-range-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .weight-range-btn {
    background: none;
    border: none;
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .weight-range-btn + .weight-range-btn {
    border-left: 1px solid var(--border);
  }

  .weight-range-btn:hover {
    color: var(--ink);
  }

  .weight-range-btn-active {
    background: var(--accent-light, rgba(0, 0, 0, 0.05));
    color: var(--ink);
    font-weight: 600;
  }

  /* ── Progress tab layout ── */
  .progress-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  @media (min-width: 768px) {
    .progress-layout {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-6);
    }

    .progress-layout:not(.progress-sidebar-collapsed) {
      grid-template-columns: 2fr 1fr;
    }
  }

  .progress-main {
    min-width: 0;
  }

  .progress-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: flex-end;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--paper);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .sidebar-toggle:hover {
    color: var(--ink);
    background: var(--paper-warm);
  }

  /* ── Calendar ── */
  .calendar-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .calendar-view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .calendar-view-btn {
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .calendar-view-btn + .calendar-view-btn {
    border-left: 1px solid var(--border);
  }

  .calendar-view-btn:hover {
    color: var(--ink);
  }

  .calendar-view-btn-active {
    background: var(--accent-light, rgba(0, 0, 0, 0.05));
    color: var(--ink);
    font-weight: 600;
  }

  .calendar-month-label {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .calendar-grid {
    display: flex;
    flex-direction: column;
  }

  .calendar-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr) minmax(0, 1fr);
  }

  .calendar-row-alt {
    background: var(--paper-warm);
  }

  .calendar-dow {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    text-align: center;
    padding: var(--space-2) 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .calendar-cell {
    aspect-ratio: 1;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-rows: auto 1fr;
    padding: var(--space-1);
    border: 1px solid var(--border);
    transition: background var(--transition-fast);
    overflow: hidden;
    min-height: 0;
  }

  .calendar-cell-active {
    cursor: pointer;
  }

  .calendar-cell-active:hover {
    background: var(--paper-warm);
  }

  .calendar-cell-today {
    background: var(--accent-light, rgba(0, 0, 0, 0.05));
    font-weight: 600;
  }

  .calendar-cell-summary {
    border-left: 2px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 1px;
    justify-content: flex-end;
    align-items: flex-start;
    padding: var(--space-1);
  }

  .calendar-day-number {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    line-height: 1;
  }

  .cal-dow-label {
    display: none;
  }

  .cal-weather {
    justify-self: center;
    align-self: start;
    font-size: var(--text-xs);
    line-height: 1;
  }

  .cal-rating {
    justify-self: end;
    align-self: start;
  }

  .cal-sticker {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
    align-self: end;
  }

  .cal-medal {
    margin-bottom: auto;
  }

  /* Previous/next-month days that pad out the month grid */
  .calendar-cell-outside {
    opacity: 0.5;
  }

  .cal-stats {
    grid-column: 1 / 3;
    display: flex;
    flex-direction: column;
    gap: 1px;
    align-self: end;
  }

  .cal-stat-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .cal-icon {
    width: 14px;
    height: 14px;
    color: var(--accent-green);
    flex-shrink: 0;
  }

  .cal-dots {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .cal-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--border);
  }

  .cal-dot-filled {
    background: var(--accent-green);
  }

  .cal-micro {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--ink-light);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .cal-deficit {
    color: var(--accent-green);
  }

  .cal-surplus {
    color: var(--accent);
  }

  /* Week view stacks into a readable list on narrow screens instead of shrinking 7 columns */
  @media (max-width: 767px) {
    .calendar-grid-week .calendar-row.calendar-row-header {
      display: none;
    }

    .calendar-grid-week .calendar-row {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .calendar-grid-week .calendar-cell {
      aspect-ratio: unset;
      grid-template-columns: auto 1fr auto;
      grid-template-rows: auto auto;
      row-gap: var(--space-2);
      padding: var(--space-3);
      border-radius: var(--radius-sm);
    }

    .calendar-grid-week .cal-dow-label {
      display: inline;
      margin-right: var(--space-1);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-faint);
      font-size: var(--text-xs);
    }

    .calendar-grid-week .calendar-day-number {
      font-size: var(--text-base);
    }

    .calendar-grid-week .cal-sticker {
      z-index: 1;
    }

    .calendar-grid-week .cal-stats {
      grid-column: 1 / -1;
      grid-row: 2;
      align-self: start;
      gap: var(--space-1);
    }

    .calendar-grid-week .cal-icon {
      width: 16px;
      height: 16px;
    }

    .calendar-grid-week .cal-micro {
      font-size: var(--text-sm);
      white-space: normal;
    }

    .calendar-grid-week .calendar-cell-summary {
      border-left: none;
      border-top: 2px solid var(--border);
      padding: var(--space-3) var(--space-1) 0;
      align-items: stretch;
    }

    .calendar-grid-week .calendar-cell-summary::before {
      content: "This Week";
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-faint);
    }
  }

  /* ── Day Detail Modal ── */
  .day-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .day-modal {
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    max-width: 480px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .day-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .day-modal-date {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .day-modal-close {
    background: none;
    border: none;
    font-size: var(--text-lg);
    color: var(--ink-faint);
    cursor: pointer;
    padding: var(--space-1);
  }

  .day-modal-close:hover {
    color: var(--ink);
  }

  .day-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .day-section-title {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
  }

  .day-section-content {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .day-workout-row {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    text-decoration: none;
    color: var(--ink);
    transition: opacity var(--transition-fast);
  }

  .day-workout-row:hover {
    opacity: 0.7;
  }

  .day-workout-name {
    font-weight: 500;
    flex: 1;
  }

  .day-workout-stat {
    color: var(--ink-light);
    font-size: var(--text-xs);
  }

  .day-pr-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: var(--radius-pill);
    background: var(--accent-green);
    color: white;
    text-transform: uppercase;
  }

  .day-rating-row {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .day-rating-label {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    min-width: 50px;
  }

  /* ── Journal ── */
  .journal-section {
    max-width: 640px;
  }

  .date-nav {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }

  .date-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .date-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .date-btn:hover:not(:disabled) {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .date-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .date-input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .date-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .journal-empty {
    text-align: center;
    padding: var(--space-6) var(--space-4);
  }

  .journal-empty-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
  }

  .journal-weather {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .weather-icon {
    font-size: var(--text-lg);
  }

  .weather-temps {
    font-weight: 500;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .weather-precip {
    color: var(--ink-faint);
  }

  .weather-fetch-btn {
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .weather-fetch-btn:disabled {
    cursor: default;
    text-decoration: none;
  }

  .journal-tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-6);
  }

  .journal-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .journal-tab:hover {
    color: var(--ink-light);
  }

  .journal-tab-active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  .journal-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .journal-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .journal-field input[type="text"],
  .journal-field input[type="number"] {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    transition: border-color var(--transition-fast);
    width: 100%;
  }

  .journal-field input:focus {
    border-bottom-color: var(--border-strong);
  }

  .journal-field input::placeholder {
    color: var(--ink-faint);
  }

  .intention-hint {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    background: var(--paper-warm);
    border-radius: var(--radius-sm);
  }

  .intention-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-faint);
    white-space: nowrap;
  }

  .day-check {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--accent-red-soft);
    border-left: 3px solid var(--accent-red);
    border-radius: var(--radius-sm);
  }

  .day-check-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent-red);
  }

  .day-check-list {
    margin: 0;
    padding-left: var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .intention-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    font-style: italic;
    margin: 0;
  }
</style>
