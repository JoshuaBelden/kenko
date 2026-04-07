<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, ProgressBar, StarRating, DotRating, TipTapEditor } from "$lib/components"
  import { localToday, localDateStr, localTimeStr, toDatetime } from "$lib/dates"
  import { formatDate } from "$lib/format"
  import { icons } from "$lib/icons"

  const data = $derived(page.data as any)
  const tz = $derived(page.data.user?.profile?.timezone ?? "America/Los_Angeles")
  const journey = $derived(data.journey)
  const allPlans = $derived(data.allPlans ?? [])
  const allCommitments = $derived(data.allCommitments ?? [])
  const tdee = $derived(data.tdee as number | null)

  // Determine if newly created (no targets configured)
  const hasAnyTargets = $derived(
    journey?.shokuTargets || journey?.danjikiTargets || journey?.dojoTargets || journey?.kataTargets,
  )

  type Tab = "overview" | "history" | "journal"
  let activeTab = $state<Tab>("overview")
  let showSettings = $state(false)

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

  const WEIGHT_GOAL_OPTIONS = [
    { value: "-2", label: "Lose 2 lb/week" },
    { value: "-1.5", label: "Lose 1.5 lb/week" },
    { value: "-1", label: "Lose 1 lb/week" },
    { value: "-0.5", label: "Lose 0.5 lb/week" },
    { value: "0", label: "Maintain weight" },
    { value: "0.5", label: "Gain 0.5 lb/week" },
    { value: "1", label: "Gain 1 lb/week" },
    { value: "1.5", label: "Gain 1.5 lb/week" },
    { value: "2", label: "Gain 2 lb/week" },
  ] as const

  // Danjiki settings
  let weeklyFastingHours = $state("")

  // Dojo settings
  let selectedPlanIds = $state<string[]>([])
  let dojoSessionsPerWeek = $state("")
  let dojoWeeklyCalorieBurn = $state("")

  // Kata settings
  let selectedCommitmentIds = $state<string[]>([])

  // Computed calorie target from weight goal + TDEE
  const deficitPerDay = $derived(() => {
    const goal = Number(weightGoalLbsPerWeek)
    if (!goal) return 0
    return Math.round(goal * 500) // 1lb = 3500 kcal / 7 days = 500
  })

  const calculatedCalorieTarget = $derived(() => {
    if (!tdee) return null
    const deficit = deficitPerDay()
    return tdee + deficit // deficit is negative for loss
  })

  const effectiveCalorieTarget = $derived(() => {
    if (dailyCalorieOverride && dailyCalorieTarget) return Number(dailyCalorieTarget)
    return calculatedCalorieTarget()
  })

  // Macro conversions
  function macroGramsFromPct(pct: number, caloriesPerGram: number): number | null {
    const cal = effectiveCalorieTarget()
    if (!cal) return null
    return Math.round((cal * (pct / 100)) / caloriesPerGram)
  }

  function macroPctFromGrams(grams: number, caloriesPerGram: number): number | null {
    const cal = effectiveCalorieTarget()
    if (!cal) return null
    return Math.round(((grams * caloriesPerGram) / cal) * 100)
  }

  const proteinRef = $derived(() => {
    const v = Number(proteinValue)
    if (!v) return null
    return macroMode === "percentage"
      ? `${macroGramsFromPct(v, 4) ?? "—"}g`
      : `${macroPctFromGrams(v, 4) ?? "—"}%`
  })

  const carbsRef = $derived(() => {
    const v = Number(carbsValue)
    if (!v) return null
    return macroMode === "percentage"
      ? `${macroGramsFromPct(v, 4) ?? "—"}g`
      : `${macroPctFromGrams(v, 4) ?? "—"}%`
  })

  const fatRef = $derived(() => {
    const v = Number(fatValue)
    if (!v) return null
    return macroMode === "percentage"
      ? `${macroGramsFromPct(v, 9) ?? "—"}g`
      : `${macroPctFromGrams(v, 9) ?? "—"}%`
  })

  const macroPctTotal = $derived(() => {
    if (macroMode !== "percentage") return null
    return (Number(proteinValue) || 0) + (Number(carbsValue) || 0) + (Number(fatValue) || 0)
  })

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

  let confirmingArchive = $state(false)

  async function unarchiveJourney() {
    await fetch(`/api/journeys/${journey.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    })
    await invalidateAll()
  }

  let confirmingDelete = $state(false)

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
    if (journey && hasAnyTargets && activeTab === "overview" && !showSettings) {
      loadOverview()
    }
  })

  // ── Weight chart derived data ──
  const weightChart = $derived.by(() => {
    const w = overviewData?.weight
    if (!w || !w.entries.length) return null

    const entries = w.entries as Array<{ date: string; weight: number }>
    const goalRate = w.weightGoalLbsPerWeek as number | null
    const jStart = new Date(w.journeyStart)
    const jEnd = new Date(w.journeyEnd)
    const today = new Date(localToday(tz) + "T00:00:00")

    // X-axis ends 1 month from today (capped at journey end)
    const oneMonthOut = new Date(today)
    oneMonthOut.setMonth(oneMonthOut.getMonth() + 1)
    const chartEnd = oneMonthOut < jEnd ? oneMonthOut : jEnd

    const totalMs = chartEnd.getTime() - jStart.getTime()
    if (totalMs <= 0) return null

    const lastEntry = entries[entries.length - 1]
    const firstEntry = entries[0]

    // Goal weight projected to chart end
    const weeksToChartEnd = (chartEnd.getTime() - new Date(firstEntry.date + "T12:00:00").getTime()) / (7 * 86400000)
    const goalWeightAtEnd = goalRate ? firstEntry.weight + goalRate * weeksToChartEnd : null

    // Y-axis from actual entries, extended to include projection
    const actualWeights = entries.map((e) => e.weight)
    const allWeights = [...actualWeights, ...(goalWeightAtEnd != null ? [goalWeightAtEnd] : [])]
    const minW = Math.min(...allWeights)
    const maxW = Math.max(...allWeights)
    const padding = Math.max((maxW - minW) * 0.15, 1)

    return {
      entries,
      goalRate,
      goalWeightAtEnd,
      jStart,
      chartEnd,
      totalMs,
      lastEntry,
      yMin: minW - padding,
      yMax: maxW + padding,
      journeyStart: w.journeyStart as string,
      chartEndLabel: `${String(chartEnd.getMonth() + 1).padStart(2, "0")}-${String(chartEnd.getDate()).padStart(2, "0")}`,
    }
  })

  // ── Journal state ──
  let journalDate = $state("")
  let journalEntry = $state<any>(null)
  let journalLoading = $state(false)
  let journalTab = $state<"morning" | "evening">("morning")
  let yesterdayIntention = $state<string | null>(null)

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

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]
  }
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
  <!-- ════════════ SETTINGS ════════════ -->
  <div class="settings-panel">
    <h2 class="section-title">Journey Settings</h2>

    <!-- General -->
    <Card>
      <h3 class="card-title">General</h3>
      <div class="settings-fields">
        <div class="field">
          <label class="field-label" for="s-name">Journey name</label>
          <input id="s-name" bind:value={settingsName} placeholder="Journey name" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="s-start">Start date</label>
            <input id="s-start" type="date" bind:value={settingsStartDate} />
          </div>
          <div class="field">
            <label class="field-label" for="s-start-time">Start time</label>
            <input id="s-start-time" type="time" bind:value={settingsStartTime} />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="s-end">End date</label>
            <input id="s-end" type="date" bind:value={settingsEndDate} />
          </div>
          <div class="field">
            <label class="field-label" for="s-end-time">End time</label>
            <input id="s-end-time" type="time" bind:value={settingsEndTime} />
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="s-desc">Description</label>
          <input id="s-desc" bind:value={settingsDesc} placeholder="Optional description" />
        </div>
        <div class="field">
          <span class="field-label">Why this journey matters</span>
          <TipTapEditor
            content={settingsStatement}
            onblur={(html) => { settingsStatement = html }}
            placeholder="What drives this journey..."
          />
        </div>
      </div>
    </Card>

    <!-- Shoku -->
    <Card>
      <h3 class="card-title">Shoku — Nutrition</h3>
      {#if !tdee}
        <p class="module-hint">
          Set up your <a href="/profile">profile</a> with body metrics to enable TDEE-based calorie
          targets.
        </p>
      {/if}
      <div class="settings-fields">
        <div class="field">
          <label class="field-label" for="s-weight-goal">Weight goal</label>
          <select id="s-weight-goal" bind:value={weightGoalLbsPerWeek}>
            {#each WEIGHT_GOAL_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          {#if Number(weightGoalLbsPerWeek) !== 0 && tdee}
            <p class="field-hint">
              {Number(weightGoalLbsPerWeek) < 0 ? "To lose" : "To gain"}
              {Math.abs(Number(weightGoalLbsPerWeek))}lb/week you need a
              {Math.abs(deficitPerDay())} kcal/day {Number(weightGoalLbsPerWeek) < 0 ? "deficit" : "surplus"}.
              Your TDEE is {tdee.toLocaleString()} kcal so your daily target is
              {calculatedCalorieTarget()?.toLocaleString() ?? "—"} kcal.
            </p>
          {/if}
        </div>

        <div class="field">
          <label class="override-toggle">
            <input type="checkbox" bind:checked={dailyCalorieOverride} />
            <span>Override daily calorie target</span>
          </label>
          {#if dailyCalorieOverride}
            <input
              type="number"
              bind:value={dailyCalorieTarget}
              placeholder="Custom daily calories"
            />
          {/if}
        </div>

        <!-- Macros -->
        <div class="macro-section">
          <div class="macro-header">
            <span class="field-label">Macro targets</span>
            <div class="macro-mode-toggle">
              <button
                class="macro-mode-btn"
                class:macro-mode-btn-active={macroMode === "percentage"}
                onclick={() => (macroMode = "percentage")}
              >Percentage</button>
              <button
                class="macro-mode-btn"
                class:macro-mode-btn-active={macroMode === "grams"}
                onclick={() => (macroMode = "grams")}
              >Grams</button>
            </div>
          </div>
          {#each [
            { name: "Protein", value: proteinValue, ref: proteinRef, setValue: (v: string) => (proteinValue = v) },
            { name: "Carbs", value: carbsValue, ref: carbsRef, setValue: (v: string) => (carbsValue = v) },
            { name: "Fat", value: fatValue, ref: fatRef, setValue: (v: string) => (fatValue = v) },
          ] as macro}
            <div class="macro-row">
              <span class="macro-name">{macro.name}</span>
              <input
                type="number"
                class="macro-input"
                value={macro.value}
                oninput={(e) => macro.setValue(e.currentTarget.value)}
                placeholder={macroMode === "percentage" ? "%" : "g"}
              />
              <span class="macro-unit">{macroMode === "percentage" ? "%" : "g"}</span>
              {#if macro.ref()}
                <span class="macro-ref">= {macro.ref()}</span>
              {/if}
            </div>
          {/each}
          {#if macroMode === "percentage"}
            {@const total = macroPctTotal()}
            <div class="macro-total" class:macro-total-ok={total === 100} class:macro-total-warn={total !== null && total !== 0 && total !== 100}>
              <span>Total: {total ?? 0}%</span>
              {#if total !== null && total !== 0 && total !== 100}
                <span class="macro-total-hint">({total < 100 ? `${100 - total}% remaining` : `${total - 100}% over`})</span>
              {/if}
            </div>
          {/if}
        </div>

        <div class="field">
          <label class="field-label" for="s-water">Daily water target (oz)</label>
          <input id="s-water" type="number" bind:value={dailyWaterTargetOz} placeholder="e.g. 64" />
        </div>
      </div>
    </Card>

    <!-- Danjiki -->
    <Card>
      <h3 class="card-title">Danjiki — Fasting</h3>
      <div class="settings-fields">
        <div class="field">
          <label class="field-label" for="s-fasting">Weekly fasting hours target</label>
          <input
            id="s-fasting"
            type="number"
            bind:value={weeklyFastingHours}
            placeholder="e.g. 16"
          />
        </div>
      </div>
    </Card>

    <!-- Dojo -->
    <Card>
      <h3 class="card-title">Dojo — Training</h3>
      {#if allPlans.length === 0}
        <p class="module-hint">
          <a href="/dojo/plans">Add workout plans</a> to configure training targets.
        </p>
      {:else}
        <div class="settings-fields">
          <div class="field">
            <span class="field-label">Workout plans</span>
            <div class="checkbox-list">
              {#each allPlans as plan}
                <label class="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedPlanIds.includes(plan.id)}
                    onchange={() => (selectedPlanIds = toggleArrayItem(selectedPlanIds, plan.id))}
                  />
                  <span>{plan.name}</span>
                </label>
              {/each}
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label" for="s-sessions">Sessions/week</label>
              <input
                id="s-sessions"
                type="number"
                bind:value={dojoSessionsPerWeek}
                placeholder="Optional"
              />
            </div>
            <div class="field">
              <label class="field-label" for="s-burn">Weekly calorie burn target</label>
              <input
                id="s-burn"
                type="number"
                bind:value={dojoWeeklyCalorieBurn}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      {/if}
    </Card>

    <!-- Kata -->
    <Card>
      <h3 class="card-title">Kata — Commitments</h3>
      {#if allCommitments.length === 0}
        <p class="module-hint">
          <a href="/kata">Add commitments</a> to track habits within this journey.
        </p>
      {:else}
        <div class="settings-fields">
          <div class="field">
            <span class="field-label">Commitments</span>
            <div class="checkbox-list">
              {#each allCommitments as commitment}
                <label class="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedCommitmentIds.includes(commitment.id)}
                    onchange={() => (selectedCommitmentIds = toggleArrayItem(selectedCommitmentIds, commitment.id))}
                  />
                  <div class="commitment-info">
                    <span>{commitment.name}</span>
                    <span class="commitment-meta">{commitment.period} &middot; target: {commitment.targetValue}{commitment.unit ? ` ${commitment.unit}` : ""}</span>
                  </div>
                </label>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </Card>

    <div class="settings-actions">
      <Button variant="primary" onclick={saveSettings} disabled={saving}>
        {saving ? "Saving..." : "Save settings"}
      </Button>
      <button class="btn-text" onclick={() => (showSettings = false)}>Close settings</button>
      {#if saveError}
        <p class="form-error">{saveError}</p>
      {/if}
      {#if saveSuccess}
        <p class="form-success">Settings saved.</p>
      {/if}
    </div>

    <!-- Archive / Unarchive journey -->
    <div class="danger-zone">
      {#if isArchived}
        <button class="btn-text" onclick={unarchiveJourney}>Unarchive this journey</button>
      {:else if confirmingArchive}
        <Card>
          <div class="delete-confirm">
            <p class="delete-message">Archive this journey? It will be hidden from your journey list but can be restored later.</p>
            <div class="delete-actions">
              <button class="btn-danger" onclick={archiveJourney}>Yes, archive</button>
              <button class="btn-text" onclick={() => (confirmingArchive = false)}>Cancel</button>
            </div>
          </div>
        </Card>
      {:else}
        <button class="btn-text btn-danger-text" onclick={() => (confirmingArchive = true)}>Archive this journey</button>
      {/if}
    </div>

    <!-- Delete journey -->
    <div class="danger-zone">
      {#if confirmingDelete}
        <Card>
          <div class="delete-confirm">
            <p class="delete-message">Are you sure? This will not delete any logged data — only the journey and its targets will be removed.</p>
            <div class="delete-actions">
              <button class="btn-danger" onclick={deleteJourney}>Yes, delete</button>
              <button class="btn-text" onclick={() => (confirmingDelete = false)}>Cancel</button>
            </div>
          </div>
        </Card>
      {:else}
        <button class="btn-text btn-danger-text" onclick={() => (confirmingDelete = true)}>Delete this journey</button>
      {/if}
    </div>
  </div>
{:else}
  <!-- ════════════ TAB NAVIGATION ════════════ -->
  <nav class="tab-nav">
    <button class="tab" class:tab-active={activeTab === "overview"} onclick={() => (activeTab = "overview")}>
      Dashboard
    </button>
    <button class="tab" class:tab-active={activeTab === "history"} onclick={() => (activeTab = "history")}>
      History
    </button>
    <button class="tab" class:tab-active={activeTab === "journal"} onclick={() => (activeTab = "journal")}>
      Journal
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

              {#each kata.commitments as commitment}
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
            </div>
          </Card>
        {/if}
      </div>

      <!-- Weight Chart Widget (full width, below grid) -->
      {#if weightChart}
        {@const wc = weightChart}
        {@const cW = 600}
        {@const cH = 200}
        {@const cPad = { top: 20, right: 20, bottom: 30, left: 45 }}
        {@const plotW = cW - cPad.left - cPad.right}
        {@const plotH = cH - cPad.top - cPad.bottom}
        {@const xForDate = (d: Date) => cPad.left + (plotW * (d.getTime() - wc.jStart.getTime())) / wc.totalMs}
        {@const yForWeight = (w: number) => cPad.top + plotH - (plotH * (w - wc.yMin)) / (wc.yMax - wc.yMin)}
        {@const todayDate = new Date(new Date().toISOString().split("T")[0] + "T00:00:00")}

        <div class="weight-chart-wrapper">
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
                <text x={xForDate(wc.jStart)} y={cH - 4} class="chart-label" text-anchor="start">
                  {wc.journeyStart.slice(5)}
                </text>
                {#if todayDate.getTime() > wc.jStart.getTime() && todayDate.getTime() < wc.chartEnd.getTime()}
                  <line x1={xForDate(todayDate)} y1={cPad.top} x2={xForDate(todayDate)} y2={cPad.top + plotH} class="chart-today" />
                  <text x={xForDate(todayDate)} y={cH - 4} class="chart-label" text-anchor="middle">Today</text>
                {/if}
                <text x={xForDate(wc.chartEnd)} y={cH - 4} class="chart-label" text-anchor="end">
                  {wc.chartEndLabel}
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
        </div>
      {/if}
    {/if}

  <!-- ════════════ HISTORY TAB ════════════ -->
  {:else if activeTab === "history"}
    <div class="placeholder-tab">
      <Card>
        <div class="empty-content">
          <p class="empty-message">History view is coming in a future phase.</p>
        </div>
      </Card>
    </div>

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
                step="0.1"
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
                step="0.5"
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
  .empty-overview,
  .placeholder-tab {
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

  /* ── Settings panel ── */
  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 640px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .card-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0 0 var(--space-4) 0;
  }

  .settings-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-row {
    display: flex;
    gap: var(--space-4);
  }

  .field-row .field {
    flex: 1;
  }

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field input[type="text"],
  .field input[type="number"],
  .field input[type="date"],
  .field input[type="time"],
  .field select,
  .settings-fields input[type="text"],
  .settings-fields input[type="number"],
  .settings-fields input[type="date"],
  .settings-fields input[type="time"],
  .field > input {
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

  .field select {
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0 center;
    padding-right: var(--space-5);
  }

  .field input:focus,
  .field select:focus,
  .settings-fields input:focus {
    border-bottom-color: var(--border-strong);
  }

  .field input::placeholder,
  .settings-fields input::placeholder {
    color: var(--ink-faint);
  }

  .field-hint {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    line-height: 1.6;
    color: var(--ink-light);
    margin: var(--space-1) 0 0 0;
  }

  .module-hint {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin: 0;
  }

  .module-hint a {
    color: var(--accent);
    text-decoration: none;
  }

  .module-hint a:hover {
    text-decoration: underline;
  }

  /* Override toggle */
  .override-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .override-toggle input {
    accent-color: var(--accent);
  }

  /* Macro section */
  .macro-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .macro-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .macro-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    min-width: 60px;
  }

  .macro-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .macro-mode-toggle {
    display: flex;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .macro-mode-btn {
    background: transparent;
    border: none;
    padding: var(--space-1) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .macro-mode-btn-active {
    background: var(--accent);
    color: #fff;
  }

  .macro-unit {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    min-width: 14px;
  }

  .macro-total {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
  }

  .macro-total-ok {
    color: var(--accent-green);
  }

  .macro-total-warn {
    color: var(--accent);
  }

  .macro-total-hint {
    font-size: var(--text-xs);
  }

  .macro-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    outline: none;
    width: 60px;
    transition: border-color var(--transition-fast);
  }

  .macro-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .macro-ref {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    white-space: nowrap;
  }

  /* Checkbox list */
  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .checkbox-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .checkbox-item input {
    margin-top: 2px;
    accent-color: var(--accent);
  }

  .commitment-info {
    display: flex;
    flex-direction: column;
  }

  .commitment-meta {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  /* Settings actions */
  .settings-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }

  /* Form feedback */
  .form-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
    margin: 0;
  }

  .form-success {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-green);
    margin: 0;
  }

  /* Shared buttons */
  .btn-text {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .btn-text:hover {
    color: var(--ink);
  }

  /* Danger zone */
  .danger-zone {
    padding-top: var(--space-4);
    border-top: 0.5px solid var(--border);
  }

  .btn-danger-text {
    color: var(--accent);
  }

  .btn-danger-text:hover {
    opacity: 0.8;
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .delete-message {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-light);
    margin: 0;
  }

  .delete-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-danger {
    background: var(--accent);
    color: #ffffff;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    transition: opacity var(--transition-fast);
  }

  .btn-danger:hover {
    opacity: 0.9;
  }

  /* ── Weight chart ── */
  .weight-chart-wrapper {
    margin-top: var(--space-4);
  }

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
