<script lang="ts">
  import { Button } from "$lib/components"

  interface Props {
    open: boolean
    category: string
    onclose: () => void
    onselect: (foodId: string, quantity: number, unit: string, category: string) => void
    oncreate: () => void
  }

  let { open, category, onclose, onselect, oncreate }: Props = $props()

  let query = $state("")
  let results = $state<any[]>([])
  let searching = $state(false)
  let selectedFood = $state<any | null>(null)
  let servings = $state(1)
  let selectedCategory = $state("")

  $effect(() => {
    selectedCategory = category
  })
  let searchTimeout: ReturnType<typeof setTimeout> | undefined

  async function search(q: string) {
    if (!q.trim()) {
      results = []
      return
    }
    searching = true
    const res = await fetch(`/api/shoku/foods/search?q=${encodeURIComponent(q)}`)
    if (res.ok) results = await res.json()
    searching = false
  }

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    query = val
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => search(val), 250)
  }

  function selectFood(food: any) {
    selectedFood = food
    servings = 1
    selectedCategory = category
  }

  function confirmSelection() {
    if (!selectedFood) return
    onselect(selectedFood.id, servings, "serving", selectedCategory)
    reset()
  }

  function reset() {
    query = ""
    results = []
    selectedFood = null
    servings = 1
  }

  function handleClose() {
    reset()
    onclose()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" role="presentation" onclick={handleClose}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-label="Search food items" onclick={e => e.stopPropagation()}>
      {#if selectedFood}
        <div class="modal-header">
          <h4>{selectedFood.name}</h4>
          <button class="btn-text" onclick={() => (selectedFood = null)}>Back</button>
        </div>
        <div class="confirm-form">
          <div class="food-detail">
            <span class="food-cals">{selectedFood.calories} cal / serving ({selectedFood.servingSize ?? 100}{selectedFood.baseUnit})</span>
            {#if selectedFood.brand}
              <span class="food-brand">{selectedFood.brand}</span>
            {/if}
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="log-servings">Servings</label>
              <input id="log-servings" type="number" min="0.1" step="any" bind:value={servings} />
            </div>
            <div class="form-field">
              <label class="field-label" for="log-cat">Category</label>
              <select id="log-cat" bind:value={selectedCategory}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
                <option value="uncategorized">Uncategorized</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <Button variant="primary" onclick={confirmSelection}>Add to diary</Button>
          </div>
        </div>
      {:else}
        <div class="modal-header">
          <h4>Add Food</h4>
          <button class="btn-text" onclick={handleClose}>Close</button>
        </div>
        <div class="search-input-wrap">
          <input
            class="search-input"
            type="text"
            placeholder="Search food items..."
            value={query}
            oninput={handleInput}
          />
        </div>
        <div class="results">
          {#if searching}
            <p class="results-hint">Searching...</p>
          {:else if query && results.length === 0}
            <p class="results-hint">No foods found</p>
          {/if}
          {#each results as food (food.id)}
            <button class="result-item" onclick={() => selectFood(food)}>
              <div class="result-info">
                <span class="result-name">{food.name}</span>
                {#if food.brand}
                  <span class="result-brand">{food.brand}</span>
                {/if}
              </div>
              <span class="result-cals">{food.calories} cal/srv</span>
            </button>
          {/each}
          <button
            class="result-item create-new"
            onclick={() => {
              reset()
              oncreate()
            }}
          >
            + Create new food item
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
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
    max-height: 80vh;
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

  .search-input-wrap {
    padding: var(--space-3) var(--space-5);
  }

  .search-input {
    width: 100%;
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-3) 0;
    outline: none;
  }

  .search-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .search-input::placeholder {
    color: var(--ink-faint);
  }

  .results {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0;
  }

  .results-hint {
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-3) var(--space-5);
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    color: var(--ink);
    transition: background var(--transition-fast);
  }

  .result-item:hover {
    background: var(--paper-warm);
  }

  .result-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .result-name {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .result-brand {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .result-cals {
    font-size: var(--text-sm);
    color: var(--ink-light);
    white-space: nowrap;
  }

  .create-new {
    color: var(--accent);
    font-weight: 500;
    font-size: var(--text-sm);
    border-top: 0.5px solid var(--border);
    margin-top: var(--space-2);
    padding-top: var(--space-4);
  }

  /* Confirm form */
  .confirm-form {
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .food-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .food-cals {
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .food-brand {
    font-size: var(--text-xs);
    color: var(--ink-faint);
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
  }

  .form-field input:focus,
  .form-field select:focus {
    border-bottom-color: var(--border-strong);
  }

  .form-actions {
    padding-top: var(--space-2);
  }

  .btn-text {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast);
  }

  .btn-text:hover {
    color: var(--ink);
  }
</style>
