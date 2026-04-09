<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, ProgressBar, StarRating, DotRating, TipTapEditor } from "$lib/components"
  import SettingsTabs from "$lib/components/settings/SettingsTabs.svelte"
  import { localToday, localDateStr, localTimeStr, toDatetime } from "$lib/dates"
  import { formatDate } from "$lib/format"
  import { icons } from "$lib/icons"

  const data = $derived(page.data as any)
  const tz = $derived(page.data.user?.profile?.timezone ?? "America/Los_Angeles")
  const journey = $derived(data.journey)
  const allPlans = $derived(data.allPlans ?? [])
  const allCommitments = $derived(data.allCommitments ?? [])
  const tdee = $derived(data.tdee as number | null)
  const categories = $derived(data.categories ?? [])
  const mealPlanFoods = $derived(data.mealPlanFoods ?? [])

  // Determine if newly created (no targets configured)
  const hasAnyTargets = $derived(
    journey?.shokuTargets || journey?.danjikiTargets || journey?.dojoTargets || journey?.kataTargets,
  )

  type Tab = "overview" | "journal" | "progress"
  let activeTab = $state<Tab>("overview")
  let showSettings = $state(false)

  // ── Progress tab: calendar state ──
  let calendarMonth = $state(new Date())
  const calendarToday = $derived(localToday(tz))
  let calendarData = $state<Record<string, any>>({})
  let calendarTdee = $state<number | null>(null)
  let calendarLoading = $state(false)
  let selectedDay = $state<string | null>(null)
  let progressSidebarOpen = $state(false)

  function calendarMonthStr() {
    const y = calendarMonth.getFullYear()
    const m = String(calendarMonth.getMonth() + 1).padStart(2, "0")
    return `${y}-${m}`
  }

  let lastLoadedMonth = ""
  $effect(() => {
    if (activeTab === "progress" && journey) {
      const monthKey = calendarMonthStr()
      if (monthKey !== lastLoadedMonth) {
        lastLoadedMonth = monthKey
        loadCalendarData(monthKey)
      }
    }
  })

  async function loadCalendarData(monthStr: string) {
    calendarLoading = true
    try {
      const res = await fetch(`/api/journeys/${journey.id}/calendar?month=${monthStr}`)
      if (res.ok) {
        const data = await res.json()
        calendarData = data.days ?? {}
        calendarTdee = data.tdee ?? null
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err)
    }
    calendarLoading = false
  }

  function dayData(dateStr: string) {
    return calendarData[dateStr] ?? null
  }

  function dayHasData(dateStr: string): boolean {
    return !!calendarData[dateStr]
  }

  const calendarRows = $derived.by(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const startDow = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Build flat list of day cells (null = blank)
    type Cell = { day: number; dateStr: string } | null
    const flat: Cell[] = Array(startDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      flat.push({ day: d, dateStr })
    }
    // Pad trailing blanks to complete the last week
    while (flat.length % 7 !== 0) flat.push(null)

    // Chunk into rows of 7 days + 1 summary cell
    const rows: { days: Cell[]; weekIndex: number }[] = []
    for (let i = 0; i < flat.length; i += 7) {
      rows.push({ days: flat.slice(i, i + 7), weekIndex: rows.length })
    }
    return rows
  })

  const calendarMonthLabel = $derived(
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarMonth),
  )

  function calendarPrevMonth() {
    const d = new Date(calendarMonth)
    d.setMonth(d.getMonth() - 1)
    calendarMonth = d
  }

  function calendarNextMonth() {
    const d = new Date(calendarMonth)
    d.setMonth(d.getMonth() + 1)
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
  let dailyCalorieOverride = $state(false)
  let dailyCalorieTarget = $state("")
  let macroMode = $state<"percentage" | "grams">("percentage")
  let proteinValue = $state("")
  let carbsValue = $state("")
  let fatValue = $state("")
  let dailyWaterTargetOz = $state("")

  // Danjiki settings
  let weeklyFastingHours = $state("")

  // Dojo settings
  let selectedPlanIds = $state<string[]>([])
  let dojoSessionsPerWeek = $state("")
  let dojoWeeklyCalorieBurn = $state("")

  // Kata settings
  let selectedCommitmentIds = $state<string[]>([])

  // Meal plan settings
  let mealPlanItems = $state<any[]>([])
  let mealBuilds = $state<any[]>([])

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
      case "selectedCommitmentIds": selectedCommitmentIds = value; break
      case "mealPlanItems": mealPlanItems = value; break
      case "mealBuilds": mealBuilds = value; break
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

    const k = j.kataTargets
    if (k) {
      selectedCommitmentIds = k.commitmentIds ?? []
    }

    mealPlanItems = j.shokuMealPlan?.items ?? []
    mealBuilds = j.shokuMealBuilds ?? []
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
      Number(weightGoalLbsPerWeek) !== 0 || dailyCalorieTarget || proteinValue || carbsValue || fatValue || dailyWaterTargetOz
    const shokuTargets = hasShoku
        ? {
            weightGoalLbsPerWeek: Number(weightGoalLbsPerWeek) || null,
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
        kataTargets,
        shokuMealPlan,
        shokuMealBuilds,
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
  let journalTab = $state<"morning" | "evening">("morning")
  let yesterdayIntention = $state<string | null>(null)
  let weatherRefreshing = $state(false)

  // Journal field states
  let jBodyWeight = $state("")
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
    const hasMorning = m.bodyWeight != null || m.sleepDuration != null || m.sleepQuality != null || m.notes
    if (hasMorning) journalTab = "evening"
  }

  async function loadJournalEntry() {
    if (!journey) return
    journalLoading = true
    const [entryRes, intentionRes] = await Promise.all([
      fetch(`/api/journal?journeyId=${journey.id}&date=${journalDate}`),
      fetch(`/api/journal/yesterday-intention?journeyId=${journey.id}&date=${journalDate}`),
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
    journalLoading = false
  }

  $effect(() => {
    if (journey && activeTab === "journal") {
      if (!journalDate) journalDate = localToday(tz)
      loadJournalEntry()
    }
  })

  function journalPrevDay() {
    const d = new Date(journalDate + "T00:00:00")
    d.setDate(d.getDate() - 1)
    journalDate = d.toISOString().split("T")[0]
  }

  function journalNextDay() {
    const d = new Date(journalDate + "T00:00:00")
    d.setDate(d.getDate() + 1)
    const next = d.toISOString().split("T")[0]
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


</script>

<!-- Page header -->
<div class="journey-header">
  <div class="header-left">
    <a href="/tabi" class="back-link">&larr; Tabi</a>
    <h1 class="journey-title">{journey?.name ?? "Journey"}</h1>
    {#if journey?.description}
      <p class="journey-desc">{journey.description}</p>
    {/if}
    {#if journey}
      <p class="journey-dates">
        {formatDate(journey.startDate, tz)} &mdash; {formatDate(journey.endDate, tz)}
      </p>
      <p class="journey-progress">
        Day {daysIn} of {totalDays} &middot; {daysLeft} days left &middot; {pctComplete}%
      </p>
    {/if}
  </div>
  {#if !showSettings}
    <button class="settings-link" onclick={() => (showSettings = true)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      Settings
    </button>
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
    {allCommitments}
    {selectedCommitmentIds}
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
  </nav>

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
        <!-- Shoku Widget -->
        {#if journey.shokuTargets && overviewData.shoku}
          {@const shoku = overviewData.shoku}
          {@const targets = journey.shokuTargets}
          <Card>
            <div class="widget">
              <div class="widget-header">
                <h3 class="widget-title">
                  <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.shoku}</svg>
                  Shoku
                </h3>
                <a href="/shoku" class="widget-link">View &rarr;</a>
              </div>

              {#if targets.dailyCalorieTarget}
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
            </div>
          </Card>
        {/if}

        <!-- Danjiki Widget -->
        {#if journey.danjikiTargets && overviewData.danjiki}
          {@const danjiki = overviewData.danjiki}
          {@const target = journey.danjikiTargets.weeklyFastingHours}
          <Card>
            <div class="widget">
              <div class="widget-header">
                <h3 class="widget-title">
                  <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.danjiki}</svg>
                  Danjiki
                </h3>
                <a href="/danjiki" class="widget-link">View &rarr;</a>
              </div>

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
            </div>
          </Card>
        {/if}

        <!-- Dojo Widget -->
        {#if journey.dojoTargets && overviewData.dojo}
          {@const dojo = overviewData.dojo}
          {@const targets = journey.dojoTargets}
          <Card>
            <div class="widget">
              <div class="widget-header">
                <h3 class="widget-title">
                  <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.dojo}</svg>
                  Dojo
                </h3>
                <a href="/dojo" class="widget-link">View &rarr;</a>
              </div>

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
            </div>
          </Card>
        {/if}

        <!-- Kata Widget -->
        {#if journey.kataTargets && overviewData.kata}
          {@const kata = overviewData.kata}
          <Card>
            <div class="widget">
              <div class="widget-header">
                <h3 class="widget-title">
                  <svg class="widget-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">{@html icons.kata}</svg>
                  Kata
                </h3>
                <a href="/kata" class="widget-link">View &rarr;</a>
              </div>

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
            </div>
          </Card>
        {/if}
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
      {:else}
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

        <!-- Morning / Evening tab toggle -->
        <nav class="journal-tabs">
          <button class="journal-tab" class:journal-tab-active={journalTab === "morning"} onclick={() => (journalTab = "morning")}>
            Morning
          </button>
          <button class="journal-tab" class:journal-tab-active={journalTab === "evening"} onclick={() => (journalTab = "evening")}>
            Evening
          </button>
        </nav>

        {#if journalTab === "morning"}
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
              <button class="date-btn" onclick={calendarPrevMonth}>&larr;</button>
              <span class="calendar-month-label">{calendarMonthLabel}</span>
              <button class="date-btn" onclick={calendarNextMonth}>&rarr;</button>
            </div>
            <div class="calendar-grid">
              <div class="calendar-row calendar-row-header">
                {#each ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as dow}
                  <div class="calendar-dow">{dow}</div>
                {/each}
                <div class="calendar-dow calendar-dow-summary"></div>
              </div>
              {#each calendarRows as row}
                <div class="calendar-row" class:calendar-row-alt={row.weekIndex % 2 === 1}>
                  {#each row.days as cell}
                    {#if cell}
                      {@const dd = dayData(cell.dateStr)}
                      <div
                        class="calendar-cell"
                        class:calendar-cell-today={cell.dateStr === calendarToday}
                        class:calendar-cell-active={dd}
                        onclick={() => { if (dd) selectedDay = cell.dateStr }}
                        role={dd ? "button" : undefined}
                        tabindex={dd ? 0 : undefined}
                        onkeydown={(e) => { if (dd && (e.key === "Enter" || e.key === " ")) selectedDay = cell.dateStr }}
                      >
                        <!-- Top-left: day number -->
                        <span class="calendar-day-number">{cell.day}</span>
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
                      </div>
                    {:else}
                      <div class="calendar-cell calendar-cell-empty"></div>
                    {/if}
                  {/each}
                  <div class="calendar-cell calendar-cell-summary">
                    {#if row.days.filter(Boolean).some((c) => calendarData[c!.dateStr])}
                      {@const weekDays = row.days.filter(Boolean).map((c) => calendarData[c!.dateStr]).filter(Boolean)}
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
          {@const cPad = { top: 20, right: 20, bottom: 30, left: 45 }}
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
          {#if sd.weight}
            <div class="day-section">
              <span class="day-section-title">Weight</span>
              <div class="day-section-content">
                <span>{sd.weight} lbs</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
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
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-decoration: none;
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
    gap: var(--space-2);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .settings-link:hover {
    border-color: var(--border-strong);
    color: var(--ink);
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
    font-size: 7px;
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
    font-size: 7px;
    fill: var(--ink-faint);
    font-weight: 500;
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

  .intention-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    font-style: italic;
    margin: 0;
  }
</style>
