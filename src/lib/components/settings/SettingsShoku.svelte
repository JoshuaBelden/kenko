<script lang="ts">
  import { Card } from "$lib/components"
  import MealPlanEditor from "./MealPlanEditor.svelte"
  import MealBuildEditor from "./MealBuildEditor.svelte"

  interface Props {
    tdee: number | null
    weightGoalLbsPerWeek: string
    dailyCalorieOverride: boolean
    dailyCalorieTarget: string
    macroMode: "percentage" | "grams"
    proteinValue: string
    carbsValue: string
    fatValue: string
    dailyWaterTargetOz: string
    journeyId: string
    mealPlanItems: any[]
    mealBuilds: any[]
    mealPlanFoods: any[]
    categories: any[]
    onchange: (field: string, value: any) => void
  }

  let {
    tdee,
    weightGoalLbsPerWeek,
    dailyCalorieOverride,
    dailyCalorieTarget,
    macroMode,
    proteinValue,
    carbsValue,
    fatValue,
    dailyWaterTargetOz,
    journeyId,
    mealPlanItems,
    mealBuilds,
    mealPlanFoods,
    categories,
    onchange,
  }: Props = $props()

  type ShokuSubTab = "weight-goal" | "meal-planning" | "meal-builder"
  let activeSubTab = $state<ShokuSubTab>("weight-goal")

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

  const deficitPerDay = $derived(() => {
    const goal = Number(weightGoalLbsPerWeek)
    if (!goal) return 0
    return Math.round(goal * 500)
  })

  const calculatedCalorieTarget = $derived(() => {
    if (!tdee) return null
    return tdee + deficitPerDay()
  })

  const effectiveCalorieTarget = $derived(() => {
    if (dailyCalorieOverride && dailyCalorieTarget) return Number(dailyCalorieTarget)
    return calculatedCalorieTarget()
  })

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
</script>

<nav class="shoku-sub-tabs">
  <button class="sub-tab" class:sub-tab-active={activeSubTab === "weight-goal"} onclick={() => (activeSubTab = "weight-goal")}>Weight Goal</button>
  <button class="sub-tab" class:sub-tab-active={activeSubTab === "meal-planning"} onclick={() => (activeSubTab = "meal-planning")}>Meal Planning</button>
  <button class="sub-tab" class:sub-tab-active={activeSubTab === "meal-builder"} onclick={() => (activeSubTab = "meal-builder")}>Meal Builder</button>
</nav>

{#if activeSubTab === "weight-goal"}
<Card>
  <h3 class="card-title">Weight Goal</h3>
  {#if !tdee}
    <p class="module-hint">
      Set up your <a href="/profile">profile</a> with body metrics to enable TDEE-based calorie
      targets.
    </p>
  {/if}
  <div class="settings-fields">
    <div class="field">
      <label class="field-label" for="s-weight-goal">Weight goal</label>
      <select id="s-weight-goal" value={weightGoalLbsPerWeek} onchange={(e) => onchange("weightGoalLbsPerWeek", e.currentTarget.value)}>
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
        <input type="checkbox" checked={dailyCalorieOverride} onchange={(e) => onchange("dailyCalorieOverride", e.currentTarget.checked)} />
        <span>Override daily calorie target</span>
      </label>
      {#if dailyCalorieOverride}
        <input
          type="number"
          value={dailyCalorieTarget}
          oninput={(e) => onchange("dailyCalorieTarget", e.currentTarget.value)}
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
            onclick={() => onchange("macroMode", "percentage")}
          >Percentage</button>
          <button
            class="macro-mode-btn"
            class:macro-mode-btn-active={macroMode === "grams"}
            onclick={() => onchange("macroMode", "grams")}
          >Grams</button>
        </div>
      </div>
      {#each [
        { name: "Protein", value: proteinValue, ref: proteinRef, key: "proteinValue" },
        { name: "Carbs", value: carbsValue, ref: carbsRef, key: "carbsValue" },
        { name: "Fat", value: fatValue, ref: fatRef, key: "fatValue" },
      ] as macro}
        <div class="macro-row">
          <span class="macro-name">{macro.name}</span>
          <input
            type="number"
            class="macro-input"
            value={macro.value}
            oninput={(e) => onchange(macro.key, e.currentTarget.value)}
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
      <input id="s-water" type="number" value={dailyWaterTargetOz} oninput={(e) => onchange("dailyWaterTargetOz", e.currentTarget.value)} placeholder="e.g. 64" />
    </div>
  </div>
</Card>
{/if}

{#if activeSubTab === "meal-planning"}
<Card>
  <h3 class="card-title">Meal Planning</h3>
  <MealPlanEditor
    items={mealPlanItems}
    foods={mealPlanFoods}
    {categories}
    {journeyId}
    macroTargets={(() => {
      const macros = { protein: null, carbs: null, fat: null } as any
      if (proteinValue) macros.protein = macroMode === "percentage" ? { percentage: Number(proteinValue), grams: null } : { percentage: null, grams: Number(proteinValue) }
      if (carbsValue) macros.carbs = macroMode === "percentage" ? { percentage: Number(carbsValue), grams: null } : { percentage: null, grams: Number(carbsValue) }
      if (fatValue) macros.fat = macroMode === "percentage" ? { percentage: Number(fatValue), grams: null } : { percentage: null, grams: Number(fatValue) }
      return macros
    })()}
    effectiveCalorieTarget={effectiveCalorieTarget()}
    onchange={(items) => onchange("mealPlanItems", items)}
  />
</Card>
{/if}

{#if activeSubTab === "meal-builder"}
<Card>
  <h3 class="card-title">Meal Builder</h3>
  <MealBuildEditor
    builds={mealBuilds}
    {mealPlanItems}
    foods={mealPlanFoods}
    {categories}
    targets={{
      calories: effectiveCalorieTarget(),
      protein: proteinValue ? (macroMode === "percentage" ? macroGramsFromPct(Number(proteinValue), 4) : Number(proteinValue)) : null,
      carbs: carbsValue ? (macroMode === "percentage" ? macroGramsFromPct(Number(carbsValue), 4) : Number(carbsValue)) : null,
      fat: fatValue ? (macroMode === "percentage" ? macroGramsFromPct(Number(fatValue), 9) : Number(fatValue)) : null,
    }}
    onchange={(builds) => onchange("mealBuilds", builds)}
  />
</Card>
{/if}

<style>
  .shoku-sub-tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-4);
  }

  .sub-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .sub-tab:hover {
    color: var(--ink-light);
  }

  .sub-tab-active {
    color: var(--ink);
    border-bottom-color: var(--accent);
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

  .field-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field input,
  .field select {
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
  .field select:focus {
    border-bottom-color: var(--border-strong);
  }

  .field input::placeholder {
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
</style>
