<script lang="ts">
  import { Button } from "$lib/components"
  import MealBuildItemPicker from "./MealBuildItemPicker.svelte"
  import { jsPDF } from "jspdf"

  interface MealBuildItem {
    foodItemId: string
    servingSize: number
    servingUnit: string
    macroType: "protein" | "carbs" | "fat"
  }

  interface MealBuild {
    id?: string
    name: string
    meals: {
      breakfast: MealBuildItem[]
      lunch: MealBuildItem[]
      dinner: MealBuildItem[]
      snack: MealBuildItem[]
    }
  }

  interface MacroTarget {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  }

  interface Props {
    builds: MealBuild[]
    mealPlanItems: any[]
    foods: any[]
    categories: any[]
    targets: MacroTarget
    onchange: (builds: MealBuild[]) => void
  }

  let { builds, mealPlanItems, foods, categories, targets, onchange }: Props = $props()

  type MealCategory = "breakfast" | "lunch" | "dinner" | "snack"
  const MEAL_CATEGORIES: MealCategory[] = ["breakfast", "lunch", "dinner", "snack"]
  const MEAL_LABELS: Record<MealCategory, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
  }

  let selectedBuildIndex = $state(0)
  let editingName = $state(false)
  let nameInput = $state("")
  let showPicker = $state(false)
  let pickerMealCategory = $state<MealCategory>("breakfast")

  const selectedBuild = $derived(builds[selectedBuildIndex] ?? null)

  function getFoodById(id: string) {
    return foods.find((f: any) => f.id === id)
  }

  function addBuild() {
    const newBuild: MealBuild = {
      name: `Day ${builds.length + 1}`,
      meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
    }
    onchange([...builds, newBuild])
    selectedBuildIndex = builds.length
  }

  function deleteBuild(index: number) {
    const updated = builds.filter((_, i) => i !== index)
    onchange(updated)
    if (selectedBuildIndex >= updated.length) {
      selectedBuildIndex = Math.max(0, updated.length - 1)
    }
  }

  function renameBuild() {
    if (!nameInput.trim() || !selectedBuild) return
    const updated = builds.map((b, i) =>
      i === selectedBuildIndex ? { ...b, name: nameInput.trim() } : b
    )
    onchange(updated)
    editingName = false
  }

  function startRename() {
    if (!selectedBuild) return
    nameInput = selectedBuild.name
    editingName = true
  }

  function openPicker(category: MealCategory) {
    pickerMealCategory = category
    showPicker = true
  }

  function addItemToMeal(planItem: any) {
    if (!selectedBuild) return
    const item: MealBuildItem = {
      foodItemId: planItem.foodItemId,
      servingSize: 1,
      servingUnit: "serving",
      macroType: planItem.macroType,
    }
    const updated = builds.map((b, i) => {
      if (i !== selectedBuildIndex) return b
      return {
        ...b,
        meals: {
          ...b.meals,
          [pickerMealCategory]: [...b.meals[pickerMealCategory], item],
        },
      }
    })
    onchange(updated)
    showPicker = false
  }

  function removeItemFromMeal(category: MealCategory, itemIndex: number) {
    if (!selectedBuild) return
    const updated = builds.map((b, i) => {
      if (i !== selectedBuildIndex) return b
      return {
        ...b,
        meals: {
          ...b.meals,
          [category]: b.meals[category].filter((_, idx) => idx !== itemIndex),
        },
      }
    })
    onchange(updated)
  }

  function updateItemServing(category: MealCategory, itemIndex: number, newSize: number) {
    if (!selectedBuild) return
    const updated = builds.map((b, i) => {
      if (i !== selectedBuildIndex) return b
      return {
        ...b,
        meals: {
          ...b.meals,
          [category]: b.meals[category].map((item, idx) =>
            idx === itemIndex ? { ...item, servingSize: newSize } : item
          ),
        },
      }
    })
    onchange(updated)
  }

  const buildTotals = $derived.by(() => {
    if (!selectedBuild) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    let calories = 0, protein = 0, carbs = 0, fat = 0
    for (const category of MEAL_CATEGORIES) {
      for (const item of selectedBuild.meals[category]) {
        const food = getFoodById(item.foodItemId)
        if (!food) continue
        calories += food.calories * item.servingSize
        protein += food.protein * item.servingSize
        carbs += food.netCarbs * item.servingSize
        fat += food.fat * item.servingSize
      }
    }
    return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
  })

  function exportGroceryList() {
    const itemMap = new Map<string, { food: any; totalServings: number }>()

    for (const build of builds) {
      for (const category of MEAL_CATEGORIES) {
        for (const item of build.meals[category]) {
          const food = getFoodById(item.foodItemId)
          if (!food) continue
          const existing = itemMap.get(item.foodItemId)
          if (existing) {
            existing.totalServings += item.servingSize
          } else {
            itemMap.set(item.foodItemId, { food, totalServings: item.servingSize })
          }
        }
      }
    }

    // Group by category
    const grouped = new Map<string, { categoryName: string; sortOrder: number; items: { name: string; amount: string }[] }>()
    const uncategorized: { name: string; amount: string }[] = []

    for (const { food, totalServings } of itemMap.values()) {
      const servingSize = food.servingSize ?? 100
      const totalAmount = Math.round(servingSize * totalServings)
      const entry = { name: food.name, amount: `${totalAmount}${food.baseUnit}` }

      if (food.categoryId) {
        const cat = categories.find((c: any) => c.id === food.categoryId)
        const catId = food.categoryId
        if (!grouped.has(catId)) {
          grouped.set(catId, { categoryName: cat?.name ?? "Unknown", sortOrder: cat?.sortOrder ?? 999, items: [] })
        }
        grouped.get(catId)!.items.push(entry)
      } else {
        uncategorized.push(entry)
      }
    }

    const sortedGroups = [...grouped.values()].sort((a, b) => a.sortOrder - b.sortOrder)
    if (uncategorized.length > 0) {
      sortedGroups.push({ categoryName: "Uncategorized", sortOrder: 999, items: uncategorized })
    }

    // Generate PDF
    const doc = new jsPDF({ unit: "pt", format: "letter" })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 40
    let y = 50

    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("Grocery List", margin, y)
    y += 30

    for (const group of sortedGroups) {
      if (y > 700) { doc.addPage(); y = 50 }

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text(group.categoryName.toUpperCase(), margin, y)
      y += 4
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, y, pageWidth - margin, y)
      y += 16

      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.setTextColor(40, 40, 40)

      for (const item of group.items.sort((a, b) => a.name.localeCompare(b.name))) {
        if (y > 720) { doc.addPage(); y = 50 }
        doc.text(item.name, margin + 10, y)
        doc.setTextColor(120, 120, 120)
        doc.text(item.amount, pageWidth - margin, y, { align: "right" })
        doc.setTextColor(40, 40, 40)
        y += 18
      }

      y += 10
    }

    doc.save("grocery-list.pdf")
  }

  function progressColor(actual: number, target: number | null): string {
    if (!target) return "var(--ink-faint)"
    const ratio = actual / target
    const off = Math.abs(1 - ratio)
    if (off <= 0.10) return "var(--accent-green, #22c55e)"
    if (off <= 0.25) return "var(--accent-amber, #f59e0b)"
    return "var(--accent-red, #ef4444)"
  }

  function progressPct(actual: number, target: number | null): number {
    if (!target) return 0
    return Math.min((actual / target) * 100, 100)
  }

  function mealCalories(category: MealCategory): number {
    if (!selectedBuild) return 0
    let cal = 0
    for (const item of selectedBuild.meals[category]) {
      const food = getFoodById(item.foodItemId)
      if (!food) continue
      cal += food.calories * item.servingSize
    }
    return Math.round(cal)
  }

  function mealMacroRows(category: MealCategory) {
    if (!selectedBuild) return []
    const mealItems = selectedBuild.meals[category]
    const groups: Record<string, { items: { food: any; item: MealBuildItem; index: number }[]; totalP: number; totalC: number; totalF: number; totalCal: number }> = {
      protein: { items: [], totalP: 0, totalC: 0, totalF: 0, totalCal: 0 },
      carbs: { items: [], totalP: 0, totalC: 0, totalF: 0, totalCal: 0 },
      fat: { items: [], totalP: 0, totalC: 0, totalF: 0, totalCal: 0 },
    }

    mealItems.forEach((item, index) => {
      const food = getFoodById(item.foodItemId)
      if (!food) return
      const group = groups[item.macroType]
      group.items.push({ food, item, index })
      group.totalP += Math.round(food.protein * item.servingSize)
      group.totalC += Math.round(food.netCarbs * item.servingSize)
      group.totalF += Math.round(food.fat * item.servingSize)
      group.totalCal += Math.round(food.calories * item.servingSize)
    })

    return (["protein", "carbs", "fat"] as const)
      .filter((type) => groups[type].items.length > 0)
      .map((type) => ({ type, ...groups[type] }))
  }
</script>

<div class="meal-build-editor">
  {#if builds.length === 0}
    <div class="empty">
      <p>No meal plans created yet.</p>
      <Button onclick={addBuild}>Create meal plan</Button>
    </div>
  {:else}
    <div class="build-selector">
      <div class="build-list">
        {#each builds as build, i}
          <button
            class="build-tab"
            class:build-tab-active={selectedBuildIndex === i}
            onclick={() => (selectedBuildIndex = i)}
          >
            {build.name}
          </button>
        {/each}
        <button class="build-tab build-tab-add" onclick={addBuild} title="Add meal plan">+</button>
        <button class="export-btn" onclick={exportGroceryList} title="Export grocery list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export grocery list
        </button>
      </div>
    </div>

    {#if selectedBuild}
      <div class="build-header">
        {#if editingName}
          <input
            class="name-input"
            bind:value={nameInput}
            onkeydown={(e) => { if (e.key === "Enter") renameBuild(); if (e.key === "Escape") editingName = false }}
          />
          <Button variant="primary" onclick={renameBuild}>Save</Button>
          <button class="btn-text" onclick={() => (editingName = false)}>Cancel</button>
        {:else}
          <h4 class="build-name">{selectedBuild.name}</h4>
          <button class="btn-icon" onclick={startRename} title="Rename">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button class="btn-icon btn-icon-danger" onclick={() => deleteBuild(selectedBuildIndex)} title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        {/if}
      </div>

      {#each MEAL_CATEGORIES as category}
        {@const rows = mealMacroRows(category)}
        {@const mealCal = mealCalories(category)}
        <div class="meal-section">
          <div class="meal-section-header">
            <h5 class="meal-section-title">
              {MEAL_LABELS[category]}
              {#if mealCal > 0}<span class="meal-cal">{mealCal} cal</span>{/if}
            </h5>
          </div>

          {#if rows.length === 0}
            <p class="meal-empty">No items yet</p>
          {:else}
            {#each rows as row}
              <div class="macro-group">
                <div class="macro-group-header">
                  <span class="macro-row-label">{row.type.toUpperCase()}</span>
                  <span class="macro-row-values">
                    {row.totalCal} cal, {row.totalP}g P, {row.totalC}g C, {row.totalF}g F
                  </span>
                </div>
                {#each row.items as entry}
                  <div class="item-row">
                    <input
                      type="number"
                      class="serving-input"
                      value={entry.item.servingSize}
                      step="any"
                      min="0.1"
                      onchange={(e) => updateItemServing(category, entry.index, parseFloat(e.currentTarget.value) || 1)}
                    />
                    <span class="item-name">{entry.food.name}</span>
                    <span class="item-cals">{Math.round(entry.food.calories * entry.item.servingSize)} cal</span>
                    <button class="remove-btn" onclick={() => removeItemFromMeal(category, entry.index)} title="Remove {entry.food.name}">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                {/each}
              </div>
            {/each}
          {/if}

          <button class="add-item-btn" onclick={() => openPicker(category)}>
            + Add item
          </button>
        </div>
      {/each}
    {/if}

    {#if selectedBuild}
      <div class="totals-summary">
        {#each [
          { label: "Calories", value: buildTotals.calories, target: targets.calories, unit: "" },
          { label: "Protein", value: buildTotals.protein, target: targets.protein, unit: "g" },
          { label: "Carbs", value: buildTotals.carbs, target: targets.carbs, unit: "g" },
          { label: "Fat", value: buildTotals.fat, target: targets.fat, unit: "g" },
        ] as row}
          <div class="totals-item">
            <span class="totals-label">{row.label}</span>
            <span class="totals-value">{row.value}{row.unit}</span>
            {#if row.target}
              <div class="progress-track">
                <div
                  class="progress-fill"
                  style="width: {progressPct(row.value, row.target)}%; background: {progressColor(row.value, row.target)}"
                ></div>
              </div>
              <span class="totals-target">target {row.target}{row.unit}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<MealBuildItemPicker
  open={showPicker}
  {mealPlanItems}
  {foods}
  onselect={addItemToMeal}
  onclose={() => (showPicker = false)}
/>

<style>
  .meal-build-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .empty {
    text-align: center;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .build-selector {
    overflow-x: auto;
  }

  .build-list {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border);
  }

  .build-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    white-space: nowrap;
    transition: all var(--transition-fast);
  }

  .build-tab:hover {
    color: var(--ink-light);
  }

  .build-tab-active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  .build-tab-add {
    font-size: var(--text-base);
    padding: var(--space-1) var(--space-3);
  }

  .export-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    white-space: nowrap;
    transition: color var(--transition-fast);
  }

  .export-btn:hover {
    color: var(--accent);
  }

  .build-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .build-name {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .name-input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-1) 0;
    outline: none;
    flex: 1;
  }

  .name-input:focus {
    border-bottom-color: var(--accent);
  }

  .btn-icon {
    background: none;
    border: none;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--ink-faint);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .btn-icon:hover {
    color: var(--ink);
  }

  .btn-icon-danger:hover {
    color: var(--accent);
  }

  .btn-text {
    background: none;
    border: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    cursor: pointer;
  }

  .meal-section {
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .meal-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .meal-section-title {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .meal-cal {
    font-weight: 400;
    font-size: var(--text-xs);
    color: var(--ink-light);
    text-transform: none;
    letter-spacing: normal;
  }

  .meal-empty {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    margin: 0;
    font-style: italic;
  }

  .macro-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .macro-group-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .macro-row-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-faint);
  }

  .macro-row-values {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    padding-left: var(--space-3);
  }

  .item-name {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink);
    flex: 1;
  }

  .item-cals {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .serving-input {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-1) 0;
    outline: none;
    width: 40px;
    text-align: center;
    transition: border-color var(--transition-fast);
  }

  .serving-input:focus {
    border-bottom-color: var(--accent);
  }

  .remove-btn {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--ink-faint);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
    flex-shrink: 0;
  }

  .remove-btn:hover {
    color: var(--accent);
  }

  .add-item-btn {
    background: none;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
  }

  .add-item-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .totals-summary {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--paper-warm);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .totals-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .totals-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .totals-value {
    font-family: var(--font-body);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink);
  }

  .totals-target {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }
</style>
