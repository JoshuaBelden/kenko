<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"
  import FoodSearchModal from "$lib/components/FoodSearchModal.svelte"
  import { getCompatibleUnits, unitLabel, type DiaryUnit } from "$lib/units"

  let grouped = $state(page.data.grouped ?? {})
  let totals = $state(page.data.totals ?? { calories: 0, protein: 0, netCarbs: 0, fat: 0 })
  let currentDate = $state(page.data.date ?? new Date().toISOString().split("T")[0])
  let waterOunces = $state(page.data.waterOunces ?? 0)
  let mealBuilds = $state<any[]>([])
  let selectedMealBuild = $state<any>(null)
  let selectedMealId = $state("")
  let activeJourneyId = $state<string | null>(null)
  let macroTargets = $state<{ calories: number | null; protein: number | null; netCarbs: number | null; fat: number | null; waterOz: number | null } | null>(null)

  $effect(() => {
    const d = page.data as any
    grouped = d.grouped ?? {}
    totals = d.totals ?? { calories: 0, protein: 0, netCarbs: 0, fat: 0 }
    currentDate = d.date ?? new Date().toISOString().split("T")[0]
    waterOunces = d.waterOunces ?? 0
    mealBuilds = d.mealBuilds ?? []
    selectedMealBuild = d.selectedMealBuild ?? null
    selectedMealId = d.selectedMealBuild?.id ?? ""
    activeJourneyId = d.activeJourneyId ?? null
    macroTargets = d.macroTargets ?? null
  })

  // Food search modal state
  let searchOpen = $state(false)
  let searchCategory = $state("uncategorized")

  // Quick add state
  let quickAddOpen = $state(false)
  let quickName = $state("")
  let quickCalories = $state("")
  let quickError = $state("")

  // Edit entry state
  let editingId = $state<string | null>(null)
  let editQuantity = $state(0)
  let editUnit = $state<DiaryUnit>("serving")
  let editBaseUnit = $state<"g" | "ml">("g")
  let editCategory = $state("")
  let editNote = $state("")
  let deletingId = $state<string | null>(null)

  // Water tracking state
  let waterAdd = $state("")
  let waterSaving = $state(false)

  async function addWater() {
    const oz = parseFloat(waterAdd)
    if (!oz || oz <= 0) return
    waterSaving = true
    const newTotal = waterOunces + oz
    const res = await fetch("/api/shoku/water", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ounces: newTotal, date: currentDate }),
    })
    if (res.ok) {
      waterOunces = newTotal
      waterAdd = ""
    }
    waterSaving = false
  }

  async function resetWater() {
    waterSaving = true
    const res = await fetch("/api/shoku/water", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ounces: 0, date: currentDate }),
    })
    if (res.ok) {
      waterOunces = 0
    }
    waterSaving = false
  }

  const CATEGORIES = [
    { key: "uncategorized", label: "Uncategorized" },
    { key: "breakfast", label: "Breakfast" },
    { key: "lunch", label: "Lunch" },
    { key: "dinner", label: "Dinner" },
    { key: "snack", label: "Snack" },
  ]

  function navigateDate(dateStr: string) {
    goto(`/shoku?date=${dateStr}`, { invalidateAll: true })
  }

  function prevDay() {
    const d = new Date(currentDate + "T00:00:00")
    d.setDate(d.getDate() - 1)
    navigateDate(d.toISOString().split("T")[0])
  }

  function nextDay() {
    const d = new Date(currentDate + "T00:00:00")
    d.setDate(d.getDate() + 1)
    navigateDate(d.toISOString().split("T")[0])
  }

  async function useMealBuild() {
    const id = selectedMealId || null
    await fetch("/api/shoku/meal-build-log", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealBuildId: id, journeyId: activeJourneyId, date: currentDate }),
    })
    await invalidateAll()
  }

  async function addFromMealBuild(hint: any, category: string) {
    await handleFoodSelect(hint.foodItemId, hint.servingSize, hint.servingUnit, category)
  }

  function visibleHints(categoryKey: string) {
    if (!selectedMealBuild?.meals?.[categoryKey]) return []
    const entries = grouped[categoryKey] ?? []
    const loggedFoodIds = new Set(entries.map((e: any) => e.foodItemId))
    return selectedMealBuild.meals[categoryKey].filter((h: any) => !loggedFoodIds.has(h.foodItemId))
  }

  function openSearch(cat: string) {
    searchCategory = cat
    searchOpen = true
  }

  async function handleFoodSelect(foodId: string, quantity: number, unit: string, category: string) {
    searchOpen = false
    const res = await fetch("/api/shoku/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodItemId: foodId, quantity, unit, category, date: currentDate }),
    })
    if (res.ok) await invalidateAll()
  }

  async function handleQuickAdd() {
    if (!quickName.trim()) {
      quickError = "Name is required"
      return
    }
    const cal = parseInt(quickCalories)
    if (!cal || cal <= 0) {
      quickError = "Enter a valid calorie amount"
      return
    }

    const res = await fetch("/api/shoku/diary/quickadd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: quickName.trim(), calories: cal, date: currentDate }),
    })
    if (res.ok) {
      quickAddOpen = false
      quickName = ""
      quickCalories = ""
      quickError = ""
      await invalidateAll()
    } else {
      const err = await res.json()
      quickError = err.error ?? "Failed"
    }
  }

  function startEdit(entry: any) {
    editingId = entry.id
    editQuantity = entry.quantity
    editUnit = entry.unit ?? "serving"
    editBaseUnit = entry.foodBaseUnit ?? "g"
    editCategory = entry.category
    editNote = entry.note ?? ""
  }

  async function saveEdit() {
    if (!editingId) return
    const res = await fetch(`/api/shoku/diary/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: editQuantity,
        unit: editUnit,
        category: editCategory,
        note: editNote || null,
      }),
    })
    if (res.ok) {
      editingId = null
      await invalidateAll()
    }
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/shoku/diary/${id}`, { method: "DELETE" })
    if (res.ok) {
      deletingId = null
      await invalidateAll()
    }
  }


</script>

<PageHeader icon={icons.shoku} title="Shoku" subtitle="Nourish with intention" />

<!-- Date picker, meal plan selector, quick add -->
<section class="date-nav">
  <button class="date-btn" onclick={prevDay}>&larr;</button>
  <input
    type="date"
    class="date-input"
    value={currentDate}
    onchange={e => navigateDate((e.target as HTMLInputElement).value)}
  />
  <button class="date-btn" onclick={nextDay}>&rarr;</button>
  {#if mealBuilds.length > 0}
    <select class="meal-select" bind:value={selectedMealId} onchange={useMealBuild}>
      <option value="">No meal plan</option>
      {#each mealBuilds as build}
        <option value={build.id}>{build.name}</option>
      {/each}
    </select>
  {/if}
  <button class="btn-quick" onclick={() => (quickAddOpen = !quickAddOpen)}>Quick add</button>
</section>

<!-- Macro summary -->
<section class="macro-bar">
  <Card>
    <div class="macro-grid">
      {#if macroTargets}
        <div class="macro-target" class:over={macroTargets.calories != null && totals.calories > macroTargets.calories * 1.05}>
          <StatNumber value={totals.calories.toString()} label="Calories" size="sm" />
          {#if macroTargets.calories}
            <div class="progress-track"><div class="progress-fill" style="width: {Math.min(100, (totals.calories / macroTargets.calories) * 100)}%"></div></div>
            <span class="target-label">{macroTargets.calories} goal</span>
          {/if}
        </div>
        <div class="macro-target" class:over={macroTargets.protein != null && totals.protein > macroTargets.protein * 1.05}>
          <StatNumber value={`${totals.protein}g`} label="Protein" size="sm" />
          {#if macroTargets.protein}
            <div class="progress-track"><div class="progress-fill" style="width: {Math.min(100, (totals.protein / macroTargets.protein) * 100)}%"></div></div>
            <span class="target-label">{macroTargets.protein}g goal</span>
          {/if}
        </div>
        <div class="macro-target" class:over={macroTargets.netCarbs != null && totals.netCarbs > macroTargets.netCarbs * 1.05}>
          <StatNumber value={`${totals.netCarbs}g`} label="Net Carbs" size="sm" />
          {#if macroTargets.netCarbs}
            <div class="progress-track"><div class="progress-fill" style="width: {Math.min(100, (totals.netCarbs / macroTargets.netCarbs) * 100)}%"></div></div>
            <span class="target-label">{macroTargets.netCarbs}g goal</span>
          {/if}
        </div>
        <div class="macro-target" class:over={macroTargets.fat != null && totals.fat > macroTargets.fat * 1.05}>
          <StatNumber value={`${totals.fat}g`} label="Fat" size="sm" />
          {#if macroTargets.fat}
            <div class="progress-track"><div class="progress-fill" style="width: {Math.min(100, (totals.fat / macroTargets.fat) * 100)}%"></div></div>
            <span class="target-label">{macroTargets.fat}g goal</span>
          {/if}
        </div>
      {:else}
        <StatNumber value={totals.calories.toString()} label="Calories" size="sm" />
        <StatNumber value={`${totals.protein}g`} label="Protein" size="sm" />
        <StatNumber value={`${totals.netCarbs}g`} label="Net Carbs" size="sm" />
        <StatNumber value={`${totals.fat}g`} label="Fat" size="sm" />
      {/if}
    </div>
  </Card>
</section>

<!-- Quick add modal -->
{#if quickAddOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" role="presentation" onclick={() => { quickAddOpen = false; quickError = "" }}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-label="Quick add food" onclick={e => e.stopPropagation()}>
      <div class="modal-header">
        <h4>Quick Add</h4>
      </div>
      <div class="modal-body">
        <div class="form-fields">
          <div class="form-field">
            <label class="field-label" for="quick-name">Food</label>
            <input id="quick-name" bind:value={quickName} placeholder="What did you eat?" />
          </div>
          <div class="form-field">
            <label class="field-label" for="quick-cal">Calories</label>
            <input id="quick-cal" type="number" bind:value={quickCalories} placeholder="Estimated calories" />
          </div>
        </div>
        {#if quickError}
          <p class="error">{quickError}</p>
        {/if}
        <div class="form-actions">
          <Button variant="primary" onclick={handleQuickAdd}>Log</Button>
          <button
            class="btn-text"
            onclick={() => {
              quickAddOpen = false
              quickError = ""
            }}>Cancel</button
          >
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Category sections -->
{#each CATEGORIES as cat (cat.key)}
  {@const entries = grouped[cat.key] ?? []}
  <section class="section">
    <div class="category-header">
      <h3>{cat.label}</h3>
      <button class="btn-add" onclick={() => openSearch(cat.key)}>+</button>
    </div>

      <div class="entries-stack">
        {#each visibleHints(cat.key) as hint}
          <div class="meal-hint">
            <button class="hint-add-btn" onclick={() => addFromMealBuild(hint, cat.key)}>Add</button>
            <span class="hint-name">{hint.foodName}</span>
            <span class="hint-detail">{hint.servingSize} {hint.servingSize === 1 ? "serving" : "servings"}</span>
            <span class="hint-macros">{Math.round(hint.protein * hint.servingSize)}P &middot; {Math.round(hint.netCarbs * hint.servingSize)}C &middot; {Math.round(hint.fat * hint.servingSize)}F</span>
          </div>
        {/each}
        {#each entries as entry (entry.id)}
          <Card>
            {#if editingId === entry.id}
              <div class="edit-form">
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label" for="edit-qty">Quantity</label>
                    <input id="edit-qty" type="number" min="0.1" step="any" bind:value={editQuantity} />
                  </div>
                  <div class="form-field">
                    <label class="field-label" for="edit-unit">Unit</label>
                    <select id="edit-unit" bind:value={editUnit}>
                      {#each getCompatibleUnits(editBaseUnit) as u}
                        <option value={u}>{unitLabel(u)}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="field-label" for="edit-cat">Category</label>
                    <select id="edit-cat" bind:value={editCategory}>
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snack">Snack</option>
                      <option value="uncategorized">Uncategorized</option>
                    </select>
                  </div>
                </div>
                <div class="form-field">
                  <label class="field-label" for="edit-note">Note</label>
                  <input id="edit-note" bind:value={editNote} placeholder="Optional note" />
                </div>
                <div class="form-actions">
                  <Button onclick={saveEdit}>Save</Button>
                  <button class="btn-text" onclick={() => (editingId = null)}>Cancel</button>
                  {#if deletingId === entry.id}
                    <div class="confirm-delete-inline">
                      <span class="confirm-text">Delete?</span>
                      <button class="confirm-btn yes" onclick={() => deleteEntry(entry.id)}>Yes</button>
                      <button class="confirm-btn no" onclick={() => (deletingId = null)}>No</button>
                    </div>
                  {:else}
                    <button class="delete-btn-sm" onclick={() => (deletingId = entry.id)}>Delete</button>
                  {/if}
                </div>
              </div>
            {:else}
              <button class="entry-row" onclick={() => startEdit(entry)}>
                <span class="entry-name">{entry.foodName}</span>
                <span class="entry-servings">{entry.quantity} {entry.unit === "serving" ? (entry.quantity === 1 ? "serving" : "servings") : unitLabel(entry.unit)}</span>
                <span class="entry-cals">{entry.calculatedCalories} cal</span>
              </button>
            {/if}
          </Card>
        {/each}
        {#if entries.length === 0}
          <p class="empty-cat">No entries yet</p>
        {/if}
      </div>
  </section>
{/each}

<!-- Water tracking -->
<section class="section">
  <div class="category-header">
    <h3>Water</h3>
  </div>
  <Card>
    <div class="water-section">
      <div class="water-total-col">
        <span class="water-total">{waterOunces} oz</span>
        {#if macroTargets?.waterOz}
          <div class="progress-track"><div class="progress-fill" style="width: {Math.min(100, (waterOunces / macroTargets.waterOz) * 100)}%"></div></div>
          <span class="target-label">{macroTargets.waterOz} oz goal</span>
        {/if}
      </div>
      <div class="water-add">
        <input
          type="number"
          class="water-input"
          min="0"
          step="any"
          placeholder="oz"
          bind:value={waterAdd}
          onkeydown={e => { if (e.key === "Enter") addWater() }}
        />
        <Button variant="primary" onclick={addWater} disabled={waterSaving}>Add</Button>
        {#if waterOunces > 0}
          <button class="btn-text" onclick={resetWater} disabled={waterSaving}>Reset</button>
        {/if}
      </div>
    </div>
  </Card>
</section>

<FoodSearchModal
  open={searchOpen}
  category={searchCategory}
  onclose={() => (searchOpen = false)}
  onselect={handleFoodSelect}
/>

<style>
  .section {
    margin-bottom: var(--space-6);
  }

  .meal-select {
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    outline: none;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b6b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0 center;
    padding-right: var(--space-5);
  }

  .meal-select:focus {
    border-bottom-color: var(--border-strong);
  }

  /* Meal hints */
  .meal-hint {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    margin-bottom: var(--space-1);
  }

  .hint-add-btn {
    background: none;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--accent);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .hint-add-btn:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .hint-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    flex: 1;
  }

  .hint-detail {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .hint-macros {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Date nav */
  .date-nav {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .date-btn {
    background: none;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-size: var(--text-base);
    color: var(--ink);
    transition: background var(--transition-fast);
  }

  .date-btn:hover {
    background: var(--paper-warm);
  }

  .date-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    outline: none;
  }

  .btn-quick {
    margin-left: auto;
    background: none;
    border: 0.5px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    transition: all var(--transition-fast);
  }

  .btn-quick:hover {
    background: var(--accent);
    color: #fff;
  }

  /* Macro bar */
  .macro-bar {
    margin-bottom: var(--space-6);
  }

  .macro-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
    text-align: center;
  }

  .macro-target {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width var(--transition-fast);
  }

  .macro-target.over .progress-fill {
    background: var(--accent-red);
  }

  .macro-target.over :global(.stat-value) {
    color: var(--accent-red);
  }

  .macro-target.over .target-label {
    color: var(--accent-red);
  }

  .target-label {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
  }

  .water-total-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 5rem;
  }

  /* Category header */
  .category-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .category-header h3 {
    font-size: var(--text-lg);
    margin: 0;
  }

  .btn-add {
    margin-left: auto;
    background: none;
    border: 0.5px solid var(--border);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: var(--text-base);
    color: var(--ink-light);
    transition: all var(--transition-fast);
  }

  .btn-add:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .entries-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .empty-cat {
    font-size: var(--text-sm);
    color: var(--ink-faint);
    padding: var(--space-2) 0;
  }

  /* Entry row */
  .entry-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    color: var(--ink);
    padding: 0;
  }

  .entry-name {
    font-size: var(--text-sm);
    font-weight: 500;
    flex: 1;
  }

  .entry-servings {
    font-size: var(--text-sm);
    color: var(--ink-faint);
    white-space: nowrap;
    padding: 0 var(--space-3);
  }

  .entry-cals {
    font-size: var(--text-sm);
    color: var(--ink-light);
    font-weight: 500;
    white-space: nowrap;
  }

  /* Edit / delete */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* Quick add modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-4);
  }

  .modal {
    background: var(--paper-card);
    border-radius: var(--radius-md);
    width: 100%;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 0.5px solid var(--border);
  }

  .modal-header h4 {
    font-size: var(--text-lg);
    margin: 0;
  }

  .modal-body {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }


  .form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-row {
    display: flex;
    gap: var(--space-4);
  }

  .form-row .form-field {
    flex: 1;
  }

  .form-field {
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

  .form-field input,
  .form-field select {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
    width: 100%;
  }

  .form-field input:focus,
  .form-field select:focus {
    border-bottom-color: var(--border-strong);
  }

  .form-field input::placeholder {
    color: var(--ink-faint);
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }

  .error {
    font-size: var(--text-sm);
    color: var(--accent);
  }

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

  .delete-btn-sm {
    padding: var(--space-2) var(--space-4);
    border: 0.5px solid var(--accent);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--accent);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .delete-btn-sm:hover {
    background: var(--accent);
    color: white;
  }

  .confirm-delete-inline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .confirm-btn {
    padding: var(--space-1) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .confirm-btn.yes {
    border-color: var(--accent);
    color: var(--accent);
  }

  .confirm-btn.yes:hover {
    background: var(--accent);
    color: white;
  }

  .confirm-btn.no {
    color: var(--ink-light);
  }

  .confirm-btn.no:hover {
    border-color: var(--ink-light);
  }

  /* Water section */
  .water-section {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .water-total {
    font-size: var(--text-lg);
    font-weight: 500;
    min-width: 5rem;
  }

  .water-add {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-left: auto;
  }

  .water-input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    outline: none;
    width: 5rem;
    text-align: right;
  }

  .water-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .water-input::placeholder {
    color: var(--ink-faint);
  }
</style>
