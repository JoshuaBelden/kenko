<script lang="ts">
  interface Props {
    open: boolean
    mealPlanItems: any[]
    foods: any[]
    onselect: (item: any) => void
    onclose: () => void
  }

  let { open, mealPlanItems, foods, onselect, onclose }: Props = $props()

  let searchQuery = $state("")
  let searchInput = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (open) {
      searchQuery = ""
      // Focus after DOM updates
      requestAnimationFrame(() => searchInput?.focus())
    }
  })

  function getFoodById(id: string) {
    return foods.find((f: any) => f.id === id)
  }

  type MacroSection = "protein" | "carbs" | "fat"
  const SECTIONS: MacroSection[] = ["protein", "carbs", "fat"]
  const LABELS: Record<MacroSection, string> = { protein: "Protein", carbs: "Carbs", fat: "Fat" }

  function itemsBySection(section: MacroSection) {
    const query = searchQuery.trim().toLowerCase()
    return mealPlanItems.filter((i: any) => {
      if (i.macroType !== section) return false
      if (!query) return true
      const food = getFoodById(i.foodItemId)
      return food?.name?.toLowerCase().includes(query) ?? false
    })
  }

  const allFilteredItems = $derived(SECTIONS.flatMap((s) => itemsBySection(s)))

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && allFilteredItems.length === 1) {
      onselect(allFilteredItems[0])
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="picker-backdrop" role="presentation" onclick={onclose}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="picker" role="dialog" aria-label="Select food from meal plan" onclick={(e) => e.stopPropagation()}>
      <div class="picker-header">
        <h4>Add from Meal Plan</h4>
        <button class="btn-close" onclick={onclose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {#if mealPlanItems.length > 0}
        <div class="picker-search">
          <input
            class="search-input"
            type="text"
            placeholder="Search foods..."
            bind:value={searchQuery}
            bind:this={searchInput}
            onkeydown={handleSearchKeydown}
          />
        </div>
      {/if}

      {#if mealPlanItems.length === 0}
        <div class="picker-empty">
          <p>No foods in your meal plan. Add foods in the Meal Planning tab first.</p>
        </div>
      {:else}
        <div class="picker-sections">
          {#each SECTIONS as section}
            {@const sectionItems = itemsBySection(section)}
            {#if sectionItems.length > 0}
              <div class="picker-section">
                <h5 class="picker-section-title">{LABELS[section]}</h5>
                {#each sectionItems as item}
                  {@const food = getFoodById(item.foodItemId)}
                  {#if food}
                    <button class="picker-item" onclick={() => onselect(item)}>
                      <span class="picker-item-name">{food.name}</span>
                      <span class="picker-item-macros">
                        {Math.round(food.calories)} cal,
                        {Math.round(food.protein)}P
                        {Math.round(food.netCarbs)}C
                        {Math.round(food.fat)}F
                      </span>
                    </button>
                  {/if}
                {/each}
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }

  .picker {
    background: var(--paper-card);
    border-radius: var(--radius-md);
    max-width: 420px;
    width: 100%;
    max-height: 70vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    border-bottom: 0.5px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--paper-card);
    z-index: 1;
  }

  .picker-header h4 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--ink-faint);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .btn-close:hover {
    color: var(--ink);
  }

  .picker-search {
    padding: var(--space-3) var(--space-4) 0;
  }

  .search-input {
    width: 100%;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .search-input:focus {
    border-bottom-color: var(--accent);
  }

  .picker-empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .picker-sections {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .picker-section-title {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
    margin: 0 0 var(--space-2) 0;
  }

  .picker-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    background: none;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    font-family: var(--font-body);
    transition: all var(--transition-fast);
    margin-bottom: var(--space-1);
  }

  .picker-item:hover {
    border-color: var(--accent);
    background: var(--paper-warm);
  }

  .picker-item-name {
    font-size: var(--text-sm);
    color: var(--ink);
    text-align: left;
    flex: 1;
    min-width: 0;
  }

  .picker-item-macros {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    white-space: nowrap;
    margin-left: var(--space-2);
  }
</style>
