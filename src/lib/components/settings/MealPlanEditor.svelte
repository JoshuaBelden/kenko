<script lang="ts">
  import { Button } from "$lib/components"
  import FoodSearchModal from "$lib/components/FoodSearchModal.svelte"

  interface MealPlanItem {
    foodItemId: string
    macroType: "protein" | "carbs" | "fat"
  }

  interface Props {
    items: MealPlanItem[]
    foods: any[]
    categories: any[]
    journeyId: string
    macroTargets: { protein: any; carbs: any; fat: any } | null
    effectiveCalorieTarget: number | null
    onchange: (items: MealPlanItem[]) => void
  }

  let { items, foods, categories, journeyId, macroTargets, effectiveCalorieTarget, onchange }: Props = $props()

  type MacroSection = "protein" | "carbs" | "fat"
  let activeSection = $state<MacroSection>("protein")
  let showFoodSearch = $state(false)
  let localFoods = $state<any[]>([])

  $effect(() => {
    localFoods = [...foods]
  })

  function getFoodById(id: string) {
    return localFoods.find((f: any) => f.id === id)
  }

  function sectionItems(section: MacroSection) {
    return items.filter((i) => i.macroType === section)
  }

  function sectionTarget(section: MacroSection) {
    if (!macroTargets || !effectiveCalorieTarget) return null
    const macro = macroTargets[section]
    if (!macro) return null

    let grams: number | null = macro.grams
    if (!grams && macro.percentage && effectiveCalorieTarget) {
      const calPerGram = section === "fat" ? 9 : 4
      grams = Math.round((effectiveCalorieTarget * (macro.percentage / 100)) / calPerGram)
    }
    if (!grams) return null

    const calPerGram = section === "fat" ? 9 : 4
    const calories = grams * calPerGram
    const pct = effectiveCalorieTarget ? Math.round((calories / effectiveCalorieTarget) * 100) : 0
    return { grams, calories, pct }
  }

  function groupByCategory(sectionItems: MealPlanItem[]) {
    const groups: Map<string, { category: any; items: (MealPlanItem & { food: any })[] }> = new Map()
    const uncategorized: (MealPlanItem & { food: any })[] = []

    for (const item of sectionItems) {
      const food = getFoodById(item.foodItemId)
      if (!food) continue
      const catId = food.categoryId
      if (catId) {
        if (!groups.has(catId)) {
          const cat = categories.find((c: any) => c.id === catId)
          groups.set(catId, { category: cat ?? { name: "Unknown" }, items: [] })
        }
        groups.get(catId)!.items.push({ ...item, food })
      } else {
        uncategorized.push({ ...item, food })
      }
    }

    const sorted = [...groups.values()].sort((a, b) => (a.category.sortOrder ?? 0) - (b.category.sortOrder ?? 0))
    if (uncategorized.length > 0) {
      sorted.push({ category: { name: "Uncategorized" }, items: uncategorized })
    }
    return sorted
  }

  async function handleFoodSelected(foodId: string) {
    // Fetch food details if not already in our local foods array
    if (!getFoodById(foodId)) {
      const res = await fetch(`/api/shoku/foods/${foodId}`)
      if (res.ok) {
        const fetchedFood = await res.json()
        localFoods = [...localFoods, fetchedFood]
      }
    }

    const newItem: MealPlanItem = {
      foodItemId: foodId,
      macroType: activeSection,
    }
    const newItems = [...items, newItem]
    onchange(newItems)

    // Auto-save to journey
    await saveToJourney(newItems)
    showFoodSearch = false
  }

  async function removeItem(index: number) {
    const newItems = items.filter((_, i) => i !== index)
    onchange(newItems)
    await saveToJourney(newItems)
  }

  async function updateFoodCategory(foodId: string, categoryId: string | null) {
    const res = await fetch(`/api/shoku/foods/${foodId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    })
    if (res.ok) {
      const idx = localFoods.findIndex((f) => f.id === foodId)
      if (idx !== -1) {
        localFoods[idx] = { ...localFoods[idx], categoryId }
        localFoods = [...localFoods]
      }
    }
  }

  async function saveToJourney(updatedItems: MealPlanItem[]) {
    await fetch(`/api/journeys/${journeyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shokuMealPlan: updatedItems.length > 0 ? { items: updatedItems } : null,
      }),
    })
  }

  function getItemIndex(foodItemId: string, macroType: string) {
    return items.findIndex((i) => i.foodItemId === foodItemId && i.macroType === macroType)
  }

  const SECTION_LABELS: Record<MacroSection, string> = {
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
  }

  const activeTarget = $derived(sectionTarget(activeSection))
  const activeGrouped = $derived(groupByCategory(sectionItems(activeSection)))
</script>

<div class="meal-plan-editor">
  <div class="section-toggle">
    {#each (["protein", "carbs", "fat"] as MacroSection[]) as section}
      {@const target = sectionTarget(section)}
      <button
        class="section-btn"
        class:section-btn-active={activeSection === section}
        onclick={() => (activeSection = section)}
      >
        {SECTION_LABELS[section]}
        {#if target}
          <span class="section-count">{sectionItems(section).length}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if activeTarget}
    <div class="daily-target">
      Daily target: {activeTarget.grams}g &middot; {activeTarget.calories}cal &middot; {activeTarget.pct}%
    </div>
  {/if}

  {#if activeGrouped.length === 0}
    <div class="empty-section">
      <p>No {SECTION_LABELS[activeSection].toLowerCase()} foods added yet.</p>
    </div>
  {:else}
    <div class="food-grid">
      {#each activeGrouped as group}
        <h4 class="category-header">{group.category.name}</h4>
        <div class="category-items">
          {#each group.items as item}
            {@const idx = getItemIndex(item.foodItemId, item.macroType)}
            <div class="food-card">
              <div class="food-card-top">
                <span class="food-card-name">{item.food.name}</span>
                <button class="food-card-delete" onclick={() => removeItem(idx)} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div class="food-card-serving">
                <span class="serving-text">{item.food.servingSize ?? 100}{item.food.baseUnit} / serving</span>
              </div>
              <div class="food-card-macros">
                <select
                  class="category-select"
                  value={item.food.categoryId ?? ""}
                  onchange={(e) => updateFoodCategory(item.food.id, e.currentTarget.value || null)}
                >
                  <option value="">Uncategorized</option>
                  {#each categories as cat}
                    <option value={cat.id}>{cat.name}</option>
                  {/each}
                </select>
                <span class="macro-tag tag-p">{Math.round(item.food.protein)}g P</span>
                <span class="macro-tag tag-c">{Math.round(item.food.netCarbs)}g C</span>
                <span class="macro-tag tag-f">{Math.round(item.food.fat)}g F</span>
                <span class="macro-tag tag-cal">{Math.round(item.food.calories)} cal</span>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <div class="add-area">
    <Button variant="secondary" onclick={() => (showFoodSearch = true)}>Add food</Button>
  </div>

</div>

<FoodSearchModal
  open={showFoodSearch}
  category="uncategorized"
  context="meal-plan"
  {categories}
  onclose={() => (showFoodSearch = false)}
  onselect={(foodId) => handleFoodSelected(foodId)}
/>

<style>
  .meal-plan-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-toggle {
    display: flex;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .section-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .section-btn-active {
    background: var(--accent);
    color: #fff;
  }

  .section-count {
    font-size: var(--text-xs);
    background: rgba(255, 255, 255, 0.2);
    padding: 0 var(--space-1);
    border-radius: var(--radius-pill);
  }

  .section-btn:not(.section-btn-active) .section-count {
    background: var(--paper-warm);
  }

  .daily-target {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    padding: var(--space-2) var(--space-3);
    background: var(--paper-warm);
    border-radius: var(--radius-sm);
    text-align: center;
  }

  .empty-section {
    text-align: center;
    padding: var(--space-6);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .food-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .category-header {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    margin: var(--space-3) 0 var(--space-1) 0;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .category-header:first-child {
    margin-top: 0;
  }

  .category-items {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .food-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--paper-card);
    flex: 1 1 calc(50% - var(--space-1));
    min-width: 180px;
    max-width: 100%;
  }

  .food-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .food-card-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
  }

  .food-card-delete {
    background: none;
    border: none;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--ink-faint);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
    flex-shrink: 0;
  }

  .food-card-delete:hover {
    color: var(--accent);
  }

  .food-card-serving {
    display: flex;
    align-items: center;
  }

  .serving-text {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .category-select {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    background: var(--paper-warm);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1px var(--space-2);
    cursor: pointer;
    outline: none;
    max-width: 100%;
  }

  .category-select:focus {
    border-color: var(--accent);
  }

  .food-card-macros {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .macro-tag {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 500;
    padding: 1px var(--space-2);
    border-radius: var(--radius-pill);
  }

  .tag-p {
    background: rgba(59, 130, 246, 0.1);
    color: rgb(59, 130, 246);
  }

  .tag-c {
    background: rgba(245, 158, 11, 0.1);
    color: rgb(245, 158, 11);
  }

  .tag-f {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  }

  .tag-cal {
    background: rgba(107, 114, 128, 0.1);
    color: rgb(107, 114, 128);
  }

  .add-area {
    padding-top: var(--space-2);
  }
</style>
