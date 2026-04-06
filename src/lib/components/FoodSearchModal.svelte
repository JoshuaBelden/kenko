<script lang="ts">
  import { Button, BarcodeScanner } from "$lib/components"

  interface Props {
    open: boolean
    category: string
    onclose: () => void
    onselect: (foodId: string, quantity: number, unit: string, category: string) => void
  }

  let { open, category, onclose, onselect }: Props = $props()

  let mode = $state<"search" | "scanner" | "create" | "confirm">("search")
  let query = $state("")
  let results = $state<any[]>([])
  let searching = $state(false)
  let selectedFood = $state<any | null>(null)
  let servings = $state(1)
  let selectedCategory = $state("")
  let scannerSupported = $state(false)
  let barcodeError = $state("")
  let scannedBarcode = $state<string | null>(null)
  let scannerComponent = $state<BarcodeScanner | null>(null)

  // Inline create form fields
  let fName = $state("")
  let fBrand = $state("")
  let fBaseUnit = $state<"g" | "ml">("g")
  let fServingSize = $state("")
  let fCalories = $state("")
  let fProtein = $state("")
  let fNetCarbs = $state("")
  let fFat = $state("")
  let fFiber = $state("")
  let fIron = $state("")
  let fCalcium = $state("")
  let fVitaminA = $state("")
  let fVitaminC = $state("")
  let fVitaminB12 = $state("")
  let fFolate = $state("")
  let fPotassium = $state("")
  let createError = $state("")
  let creating = $state(false)

  $effect(() => {
    selectedCategory = category
  })

  $effect(() => {
    scannerSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia
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
    searchTimeout = setTimeout(() => search(val), 400)
  }

  function selectFood(food: any) {
    if (food.id.startsWith("off:")) {
      populateFormFromNutritionData(food._offData)
      scannedBarcode = food._offData.barcode ?? null
      mode = "create"
    } else {
      selectedFood = food
      servings = 1
      selectedCategory = category
      mode = "confirm"
    }
  }

  function confirmSelection() {
    if (!selectedFood) return
    onselect(selectedFood.id, servings, "serving", selectedCategory)
    reset()
  }

  async function handleBarcodeScan(barcode: string) {
    barcodeError = ""
    try {
      const res = await fetch(`/api/shoku/barcode/${encodeURIComponent(barcode)}`)
      if (!res.ok) {
        barcodeError = "Failed to look up barcode"
        mode = "search"
        return
      }

      const data = await res.json()

      if (data.match) {
        onselect(data.foodItem.id, 1, "serving", category)
        reset()
        return
      }

      if (data.nutritionData) {
        scannedBarcode = barcode
        populateFormFromNutritionData(data.nutritionData)
        mode = "create"
        return
      }

      barcodeError = "No food found for this barcode"
      mode = "search"
    } catch {
      barcodeError = "Failed to look up barcode"
      mode = "search"
    }
  }

  function populateFormFromNutritionData(data: any) {
    fName = data.name ?? ""
    fBrand = data.brand ?? ""
    fBaseUnit = data.baseUnit ?? "g"
    fServingSize = data.servingSize?.toString() ?? ""
    fCalories = data.calories?.toString() ?? "0"
    fProtein = data.protein?.toString() ?? "0"
    fNetCarbs = data.netCarbs?.toString() ?? "0"
    fFat = data.fat?.toString() ?? "0"
    fFiber = data.fiber?.toString() ?? ""
    fIron = data.iron?.toString() ?? ""
    fCalcium = data.calcium?.toString() ?? ""
    fVitaminA = data.vitaminA?.toString() ?? ""
    fVitaminC = data.vitaminC?.toString() ?? ""
    fVitaminB12 = data.vitaminB12?.toString() ?? ""
    fFolate = data.folate?.toString() ?? ""
    fPotassium = data.potassium?.toString() ?? ""
  }

  async function handleInlineCreate() {
    if (!fName.trim()) {
      createError = "Name is required"
      return
    }
    creating = true
    createError = ""

    const payload = {
      name: fName.trim(),
      brand: fBrand.trim() || null,
      barcode: scannedBarcode,
      baseUnit: fBaseUnit,
      servingSize: parseFloat(fServingSize) || null,
      calories: parseFloat(fCalories) || 0,
      protein: parseFloat(fProtein) || 0,
      netCarbs: parseFloat(fNetCarbs) || 0,
      fat: parseFloat(fFat) || 0,
      fiber: parseFloat(fFiber) || null,
      iron: parseFloat(fIron) || null,
      calcium: parseFloat(fCalcium) || null,
      vitaminA: parseFloat(fVitaminA) || null,
      vitaminC: parseFloat(fVitaminC) || null,
      vitaminB12: parseFloat(fVitaminB12) || null,
      folate: parseFloat(fFolate) || null,
      potassium: parseFloat(fPotassium) || null,
      source: scannedBarcode ? "openfoodfacts" : "manual",
    }

    try {
      const res = await fetch("/api/shoku/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        createError = err.error ?? "Failed to create food item"
        creating = false
        return
      }

      const created = await res.json()
      onselect(created.id, 1, "serving", selectedCategory)
      reset()
    } catch {
      createError = "Failed to create food item"
    }
    creating = false
  }

  function reset() {
    query = ""
    results = []
    selectedFood = null
    servings = 1
    mode = "search"
    barcodeError = ""
    scannedBarcode = null
    fName = ""
    fBrand = ""
    fBaseUnit = "g"
    fServingSize = ""
    fCalories = ""
    fProtein = ""
    fNetCarbs = ""
    fFat = ""
    fFiber = ""
    fIron = ""
    fCalcium = ""
    fVitaminA = ""
    fVitaminC = ""
    fVitaminB12 = ""
    fFolate = ""
    fPotassium = ""
    createError = ""
    creating = false
  }

  function handleClose() {
    if (scannerComponent) scannerComponent.stop()
    reset()
    onclose()
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" role="presentation" onclick={handleClose}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-label="Search food items" onclick={e => e.stopPropagation()}>

      {#if mode === "scanner"}
        <div class="modal-header">
          <h4>Scan Barcode</h4>
        </div>
        <div class="scanner-wrap">
          <BarcodeScanner
            bind:this={scannerComponent}
            onscanned={handleBarcodeScan}
            onerror={() => { barcodeError = "Camera access was denied"; mode = "search" }}
            oncancelled={() => { mode = "search" }}
          />
        </div>

      {:else if mode === "create"}
        <div class="modal-header">
          <h4>New Food Item</h4>
          <button class="btn-text" onclick={() => { mode = "search"; barcodeError = "" }}>Back</button>
        </div>
        <div class="create-form">
          {#if scannedBarcode}
            <div class="form-field">
              <label class="field-label" for="cf-barcode">Barcode</label>
              <input id="cf-barcode" type="text" value={scannedBarcode} readonly class="readonly" />
            </div>
          {/if}
          <div class="form-field">
            <label class="field-label" for="cf-name">Name</label>
            <input id="cf-name" type="text" bind:value={fName} />
          </div>
          <div class="form-field">
            <label class="field-label" for="cf-brand">Brand</label>
            <input id="cf-brand" type="text" bind:value={fBrand} />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-unit">Base unit</label>
              <select id="cf-unit" bind:value={fBaseUnit}>
                <option value="g">Grams (g)</option>
                <option value="ml">Milliliters (ml)</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-serving">Serving size</label>
              <input id="cf-serving" type="number" step="any" placeholder="100" bind:value={fServingSize} />
            </div>
          </div>

          <p class="section-label">Macronutrients</p>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-cal">Calories</label>
              <input id="cf-cal" type="number" step="any" bind:value={fCalories} />
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-pro">Protein (g)</label>
              <input id="cf-pro" type="number" step="any" bind:value={fProtein} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-carb">Net Carbs (g)</label>
              <input id="cf-carb" type="number" step="any" bind:value={fNetCarbs} />
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-fat">Fat (g)</label>
              <input id="cf-fat" type="number" step="any" bind:value={fFat} />
            </div>
          </div>

          <p class="section-label">Micronutrients</p>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-fiber">Fiber (g)</label>
              <input id="cf-fiber" type="number" step="any" bind:value={fFiber} />
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-iron">Iron (mg)</label>
              <input id="cf-iron" type="number" step="any" bind:value={fIron} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-calcium">Calcium (mg)</label>
              <input id="cf-calcium" type="number" step="any" bind:value={fCalcium} />
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-vita">Vitamin A</label>
              <input id="cf-vita" type="number" step="any" bind:value={fVitaminA} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-vitc">Vitamin C (mg)</label>
              <input id="cf-vitc" type="number" step="any" bind:value={fVitaminC} />
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-vitb">Vitamin B12</label>
              <input id="cf-vitb" type="number" step="any" bind:value={fVitaminB12} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="cf-folate">Folate</label>
              <input id="cf-folate" type="number" step="any" bind:value={fFolate} />
            </div>
            <div class="form-field">
              <label class="field-label" for="cf-potas">Potassium (mg)</label>
              <input id="cf-potas" type="number" step="any" bind:value={fPotassium} />
            </div>
          </div>

          {#if createError}
            <p class="error-msg">{createError}</p>
          {/if}
          <div class="form-actions">
            <Button variant="primary" onclick={handleInlineCreate} disabled={creating}>
              {creating ? "Saving..." : "Save & add to diary"}
            </Button>
          </div>
        </div>

      {:else if mode === "confirm"}
        <div class="modal-header">
          <h4>{selectedFood.name}</h4>
          <button class="btn-text" onclick={() => { selectedFood = null; mode = "search" }}>Back</button>
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
          <div class="search-row">
            <input
              class="search-input"
              type="text"
              placeholder="Search food items..."
              value={query}
              oninput={handleInput}
            />
            {#if scannerSupported}
              <button class="scan-btn" onclick={() => { barcodeError = ""; mode = "scanner" }} title="Scan barcode">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="16" x2="17" y2="16" />
                </svg>
              </button>
            {/if}
          </div>
        </div>
        {#if barcodeError}
          <p class="barcode-error">{barcodeError}</p>
        {/if}
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
                <span class="result-source">{food.source === "openfoodfacts" ? "OpenFoodFacts" : "My Library"}</span>
              </div>
              <span class="result-cals">{food.calories} cal/srv</span>
            </button>
          {/each}
          <button
            class="result-item create-new"
            onclick={() => {
              scannedBarcode = null
              fName = query
              fBrand = ""
              fBaseUnit = "g"
              fServingSize = ""
              fCalories = ""
              fProtein = ""
              fNetCarbs = ""
              fFat = ""
              fFiber = ""
              fIron = ""
              fCalcium = ""
              fVitaminA = ""
              fVitaminC = ""
              fVitaminB12 = ""
              fFolate = ""
              fPotassium = ""
              createError = ""
              mode = "create"
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

  .search-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .search-input {
    flex: 1;
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

  .scan-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    cursor: pointer;
    color: var(--ink-light);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast), border-color var(--transition-fast);
  }

  .scan-btn:hover {
    color: var(--ink);
    border-color: var(--border-strong);
  }

  .barcode-error {
    padding: var(--space-2) var(--space-5);
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .scanner-wrap {
    flex: 1;
    min-height: 250px;
    overflow: hidden;
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

  .result-source {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-style: italic;
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

  .form-field input.readonly {
    color: var(--ink-faint);
    cursor: default;
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

  /* Create form */
  .create-form {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-label {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
    margin: var(--space-2) 0 0;
  }

  .error-msg {
    font-size: var(--text-sm);
    color: var(--accent);
  }
</style>
