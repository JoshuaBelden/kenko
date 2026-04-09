<script lang="ts">
  import { invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { BarcodeScanner, Button, Card, PageHeader } from "$lib/components"
  import { icons } from "$lib/icons"

  let addedToDiaryId = $state<string | null>(null)

  async function addToDiary(food: any) {
    const today = new Date().toISOString().split("T")[0]
    const res = await fetch("/api/shoku/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foodItemId: food.id,
        quantity: 1,
        unit: "serving",
        category: "uncategorized",
        date: today,
      }),
    })
    if (res.ok) {
      addedToDiaryId = food.id
      setTimeout(() => { addedToDiaryId = null }, 2000)
    }
  }

  let foods = $state(page.data.foods ?? [])
  let categories = $state((page.data as any).categories ?? [])
  $effect(() => {
    foods = page.data.foods ?? []
    categories = (page.data as any).categories ?? []
  })

  let searchQuery = $state("")
  let sourceFilter = $state("")
  let categoryFilter = $state("")
  let creating = $state(page.url.searchParams.get("create") === "1")
  let editingId = $state<string | null>(null)
  let expandedId = $state<string | null>(null)
  let deletingId = $state<string | null>(null)
  let formError = $state("")
  let duplicateWarning = $state("")
  let scanning = $state(false)
  let scannerSupported = $state(false)
  let scanRawJson = $state<Record<string, unknown> | null>(null)
  let scanError = $state("")
  let fBarcode = $state<string | null>(null)
  let manualLookingUp = $state(false)

  // Add Food Item search state
  let addFoodOpen = $state(false)
  let addFoodQuery = $state("")
  let addFoodResults = $state<any[]>([])
  let addFoodSearching = $state(false)
  let addFoodHasSearched = $state(false)
  let addFoodTimeout: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    scannerSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  })

  // Form fields
  let fName = $state("")
  let fBrand = $state("")
  let fBaseUnit = $state<"g" | "ml">("g")
  let fServingSize = $state("")
  let fCalories = $state("")
  let fProtein = $state("")
  let fNetCarbs = $state("")
  let fFat = $state("")
  let fSaturatedFat = $state("")
  let fTransFat = $state("")
  let fFiber = $state("")
  let fAddedSugars = $state("")
  let fCholesterol = $state("")
  let fSodium = $state("")
  let fIron = $state("")
  let fCalcium = $state("")
  let fMagnesium = $state("")
  let fVitaminA = $state("")
  let fVitaminC = $state("")
  let fVitaminB12 = $state("")
  let fVitaminE = $state("")
  let fVitaminK = $state("")
  let fFolate = $state("")
  let fPotassium = $state("")
  let fZinc = $state("")
  let fCategoryId = $state("")

  const SOURCE_LABELS: Record<string, string> = {
    manual: "Manual",
    barcode: "Barcode",
    openfoodfacts: "OFF",
    usda: "USDA",
  }

  function looksLikeBarcode(val: string): boolean {
    return /^\d{8,13}$/.test(val)
  }

  const filteredFoods = $derived(
    foods.filter((f: any) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery || f.name.toLowerCase().includes(q) || (f.barcode && f.barcode.includes(searchQuery))
      const matchesSource = !sourceFilter || f.source === sourceFilter
      const matchesCategory = !categoryFilter || f.categoryId === categoryFilter
      return matchesSearch && matchesSource && matchesCategory
    }),
  )

  async function handleBarcodeScan(barcode: string) {
    scanError = ""
    scanning = false
    try {
      const res = await fetch(`/api/shoku/barcode/${encodeURIComponent(barcode)}`)
      if (!res.ok) {
        scanError = "Failed to look up barcode"
        return
      }
      const data = await res.json()
      scanRawJson = data.raw ?? null

      if (data.match) {
        scanError = `Food item "${data.foodItem.name}" already exists for this barcode`
        return
      }

      if (data.nutritionData) {
        const d = data.nutritionData
        fBarcode = barcode
        fName = d.name ?? ""
        fBrand = d.brand ?? ""
        fBaseUnit = d.baseUnit ?? "g"
        fServingSize = d.servingSize?.toString() ?? ""
        fCalories = d.calories?.toString() ?? "0"
        fProtein = d.protein?.toString() ?? "0"
        fNetCarbs = d.netCarbs?.toString() ?? "0"
        fFat = d.fat?.toString() ?? "0"
        fSaturatedFat = d.saturatedFat?.toString() ?? ""
        fTransFat = d.transFat?.toString() ?? ""
        fFiber = d.fiber?.toString() ?? ""
        fAddedSugars = d.addedSugars?.toString() ?? ""
        fCholesterol = d.cholesterol?.toString() ?? ""
        fSodium = d.sodium?.toString() ?? ""
        fIron = d.iron?.toString() ?? ""
        fCalcium = d.calcium?.toString() ?? ""
        fMagnesium = d.magnesium?.toString() ?? ""
        fVitaminA = d.vitaminA?.toString() ?? ""
        fVitaminC = d.vitaminC?.toString() ?? ""
        fVitaminB12 = d.vitaminB12?.toString() ?? ""
        fVitaminE = d.vitaminE?.toString() ?? ""
        fVitaminK = d.vitaminK?.toString() ?? ""
        fFolate = d.folate?.toString() ?? ""
        fPotassium = d.potassium?.toString() ?? ""
        fZinc = d.zinc?.toString() ?? ""
        creating = true
        return
      }

      scanError = "No food found for this barcode"
    } catch {
      scanError = "Failed to look up barcode"
    }
  }

  async function handleBarcodeLookupFromSearch() {
    const barcode = searchQuery.trim()
    if (!barcode) return
    manualLookingUp = true
    scanError = ""
    await handleBarcodeScan(barcode)
    manualLookingUp = false
  }

  function resetForm() {
    fName = ""
    fBrand = ""
    fBaseUnit = "g"
    fServingSize = ""
    fCalories = ""
    fProtein = ""
    fNetCarbs = ""
    fFat = ""
    fSaturatedFat = ""
    fTransFat = ""
    fFiber = ""
    fAddedSugars = ""
    fCholesterol = ""
    fSodium = ""
    fIron = ""
    fCalcium = ""
    fMagnesium = ""
    fVitaminA = ""
    fVitaminC = ""
    fVitaminB12 = ""
    fVitaminE = ""
    fVitaminK = ""
    fFolate = ""
    fPotassium = ""
    fZinc = ""
    formError = ""
    duplicateWarning = ""
    fCategoryId = ""
    fBarcode = null
    scanRawJson = null
    scanError = ""
  }

  function checkDuplicateName(name: string) {
    const lower = name.toLowerCase().trim()
    const existing = foods.find((f: any) => f.name.toLowerCase() === lower && f.id !== editingId)
    duplicateWarning = existing ? `A food item named "${existing.name}" already exists` : ""
  }

  function numOrNull(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  function buildPayload() {
    return {
      name: fName.trim(),
      brand: fBrand.trim() || null,
      barcode: fBarcode,
      baseUnit: fBaseUnit,
      source: fBarcode ? "openfoodfacts" : "manual",
      debug: scanRawJson ?? null,
      servingSize: numOrNull(fServingSize),
      calories: parseFloat(fCalories) || 0,
      protein: parseFloat(fProtein) || 0,
      netCarbs: parseFloat(fNetCarbs) || 0,
      fat: parseFloat(fFat) || 0,
      saturatedFat: numOrNull(fSaturatedFat),
      transFat: numOrNull(fTransFat),
      fiber: numOrNull(fFiber),
      addedSugars: numOrNull(fAddedSugars),
      cholesterol: numOrNull(fCholesterol),
      sodium: numOrNull(fSodium),
      iron: numOrNull(fIron),
      calcium: numOrNull(fCalcium),
      magnesium: numOrNull(fMagnesium),
      vitaminA: numOrNull(fVitaminA),
      vitaminC: numOrNull(fVitaminC),
      vitaminB12: numOrNull(fVitaminB12),
      vitaminE: numOrNull(fVitaminE),
      vitaminK: numOrNull(fVitaminK),
      folate: numOrNull(fFolate),
      potassium: numOrNull(fPotassium),
      zinc: numOrNull(fZinc),
      categoryId: fCategoryId || null,
    }
  }

  async function handleCreate() {
    if (!fName.trim()) {
      formError = "Name is required"
      return
    }
    const payload = buildPayload()

    const res = await fetch("/api/shoku/foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      formError = err.error ?? "Failed to create"
      return
    }

    creating = false
    resetForm()
    await invalidateAll()
  }

  function startEdit(food: any) {
    editingId = food.id
    expandedId = null
    fName = food.name
    fBrand = food.brand ?? ""
    fBaseUnit = food.baseUnit
    fServingSize = food.servingSize?.toString() ?? ""
    fCalories = food.calories.toString()
    fProtein = food.protein.toString()
    fNetCarbs = food.netCarbs.toString()
    fFat = food.fat.toString()
    fSaturatedFat = food.saturatedFat?.toString() ?? ""
    fTransFat = food.transFat?.toString() ?? ""
    fFiber = food.fiber?.toString() ?? ""
    fAddedSugars = food.addedSugars?.toString() ?? ""
    fCholesterol = food.cholesterol?.toString() ?? ""
    fSodium = food.sodium?.toString() ?? ""
    fIron = food.iron?.toString() ?? ""
    fCalcium = food.calcium?.toString() ?? ""
    fMagnesium = food.magnesium?.toString() ?? ""
    fVitaminA = food.vitaminA?.toString() ?? ""
    fVitaminC = food.vitaminC?.toString() ?? ""
    fVitaminB12 = food.vitaminB12?.toString() ?? ""
    fVitaminE = food.vitaminE?.toString() ?? ""
    fVitaminK = food.vitaminK?.toString() ?? ""
    fFolate = food.folate?.toString() ?? ""
    fPotassium = food.potassium?.toString() ?? ""
    fZinc = food.zinc?.toString() ?? ""
    fCategoryId = food.categoryId ?? ""
    formError = ""
  }

  async function handleUpdate() {
    if (!editingId || !fName.trim()) {
      formError = "Name is required"
      return
    }
    const payload = buildPayload()

    const res = await fetch(`/api/shoku/foods/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      formError = err.error ?? "Failed to update"
      return
    }

    editingId = null
    resetForm()
    await invalidateAll()
  }

  let forceDeleteId = $state<string | null>(null)
  let forceDeleteMsg = $state("")

  async function handleDelete(id: string, force = false) {
    const url = force ? `/api/shoku/foods/${id}?force=true` : `/api/shoku/foods/${id}`
    const res = await fetch(url, { method: "DELETE" })
    if (res.ok) {
      deletingId = null
      forceDeleteId = null
      await invalidateAll()
    } else {
      const err = await res.json()
      if (res.status === 409) {
        deletingId = null
        forceDeleteId = id
        forceDeleteMsg = err.error ?? "This food has logs. Delete anyway?"
      } else {
        formError = err.error ?? "Failed to delete"
        deletingId = null
      }
    }
  }

  // Add Food Item search
  async function addFoodSearch(q: string) {
    if (!q.trim() || q.trim().length < 3) {
      addFoodResults = []
      addFoodHasSearched = false
      return
    }
    addFoodHasSearched = true
    addFoodSearching = true
    const params = new URLSearchParams({ q })
    const res = await fetch(`/api/shoku/foods/search?${params}`)
    if (res.ok) addFoodResults = await res.json()
    addFoodSearching = false
  }

  function handleAddFoodInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    addFoodQuery = val
    clearTimeout(addFoodTimeout)
    addFoodTimeout = setTimeout(() => addFoodSearch(val), 400)
  }

  async function addFoodFromResult(food: any) {
    if (food.source === "library") {
      // Already in library
      return
    }
    // It's an OFF result — populate the create form with its data
    const d = food._offData ?? food
    fBarcode = d.barcode ?? null
    fName = d.name ?? food.name ?? ""
    fBrand = d.brand ?? food.brand ?? ""
    fBaseUnit = d.baseUnit ?? "g"
    fServingSize = d.servingSize?.toString() ?? ""
    fCalories = (d.calories ?? food.calories ?? 0).toString()
    fProtein = (d.protein ?? food.protein ?? 0).toString()
    fNetCarbs = (d.netCarbs ?? food.netCarbs ?? 0).toString()
    fFat = (d.fat ?? food.fat ?? 0).toString()
    fSaturatedFat = d.saturatedFat?.toString() ?? ""
    fTransFat = d.transFat?.toString() ?? ""
    fFiber = d.fiber?.toString() ?? ""
    fAddedSugars = d.addedSugars?.toString() ?? ""
    fCholesterol = d.cholesterol?.toString() ?? ""
    fSodium = d.sodium?.toString() ?? ""
    fIron = d.iron?.toString() ?? ""
    fCalcium = d.calcium?.toString() ?? ""
    fMagnesium = d.magnesium?.toString() ?? ""
    fVitaminA = d.vitaminA?.toString() ?? ""
    fVitaminC = d.vitaminC?.toString() ?? ""
    fVitaminB12 = d.vitaminB12?.toString() ?? ""
    fVitaminE = d.vitaminE?.toString() ?? ""
    fVitaminK = d.vitaminK?.toString() ?? ""
    fFolate = d.folate?.toString() ?? ""
    fPotassium = d.potassium?.toString() ?? ""
    fZinc = d.zinc?.toString() ?? ""
    scanRawJson = null
    closeAddFood()
    creating = true
  }

  function closeAddFood() {
    addFoodOpen = false
    addFoodQuery = ""
    addFoodResults = []
    addFoodHasSearched = false
    addFoodSearching = false
  }
</script>

<PageHeader icon={icons.shoku} title="Food Library" subtitle="Your saved food items" />

<section class="controls">
  <div class="search-row">
    <input
      class="search-input"
      type="text"
      placeholder="Search foods or enter barcode..."
      bind:value={searchQuery}
      onkeydown={(e) => { if (e.key === "Enter" && looksLikeBarcode(searchQuery.trim())) handleBarcodeLookupFromSearch() }}
    />
    {#if looksLikeBarcode(searchQuery.trim())}
      <button class="icon-btn" onclick={handleBarcodeLookupFromSearch} disabled={manualLookingUp} title="Lookup barcode">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="1.5" height="16" fill="currentColor" stroke="none" />
          <rect x="5" y="4" width="1" height="16" fill="currentColor" stroke="none" />
          <rect x="8" y="4" width="2" height="16" fill="currentColor" stroke="none" />
          <rect x="12" y="4" width="1" height="16" fill="currentColor" stroke="none" />
          <rect x="14.5" y="4" width="1.5" height="16" fill="currentColor" stroke="none" />
          <rect x="18" y="4" width="1" height="16" fill="currentColor" stroke="none" />
          <rect x="20.5" y="4" width="1.5" height="16" fill="currentColor" stroke="none" />
        </svg>
      </button>
    {/if}
    {#if scannerSupported}
      <button class="icon-btn" onclick={() => { scanning = true; scanError = ""; scanRawJson = null }} title="Scan barcode">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="16" x2="17" y2="16" />
        </svg>
      </button>
    {/if}
    <select class="source-select" bind:value={sourceFilter}>
      <option value="">All sources</option>
      <option value="manual">Manual</option>
      <option value="barcode">Barcode</option>
      <option value="openfoodfacts">Open Food Facts</option>
      <option value="usda">USDA</option>
    </select>
    {#if categories.length > 0}
      <select class="source-select" bind:value={categoryFilter}>
        <option value="">All categories</option>
        {#each categories as cat}
          <option value={cat.id}>{cat.name}</option>
        {/each}
      </select>
    {/if}
  </div>
  {#if !creating && !editingId && !scanning}
    <div class="action-buttons">
      <Button
        onclick={() => {
          creating = true
          resetForm()
        }}>New food item</Button
      >
      <Button variant="secondary" onclick={() => { addFoodOpen = true }}>Add Food Item</Button>
    </div>
  {/if}
</section>

<!-- Scanner -->
{#if scanning}
  <section class="section">
    <Card>
      <div class="scanner-card">
        <h4>Scan Barcode</h4>
        <div class="scanner-container">
          <BarcodeScanner
            onscanned={handleBarcodeScan}
            onerror={() => { scanError = "Camera access was denied"; scanning = false }}
            oncancelled={() => { scanning = false }}
          />
        </div>
      </div>
    </Card>
  </section>
{/if}

<!-- Scan error -->
{#if scanError}
  <section class="section">
    <Card>
      <div class="scan-message">
        <p class="error">{scanError}</p>
        <button class="btn-text" onclick={() => { scanError = "" }}>Dismiss</button>
      </div>
    </Card>
  </section>
{/if}

<!-- Raw JSON from scan -->
{#if scanRawJson}
  <section class="section">
    <Card>
      <div class="raw-json-card">
        <div class="raw-json-header">
          <h4>Raw Open Food Facts Response</h4>
          <button class="btn-text" onclick={() => { scanRawJson = null }}>Hide</button>
        </div>
        <pre class="raw-json">{JSON.stringify(scanRawJson, null, 2)}</pre>
      </div>
    </Card>
  </section>
{/if}

<!-- Create form -->
{#if creating}
  <section class="section">
    <Card>
      {@render foodForm("Create Food Item", handleCreate, () => {
        creating = false
        resetForm()
      })}
    </Card>
  </section>
{/if}

<!-- Edit modal -->
{#if editingId}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" role="presentation" onclick={() => { editingId = null; resetForm() }}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-label="Edit food item" onclick={e => e.stopPropagation()}>
      <div class="modal-body">
        {@render foodForm("Edit Food Item", handleUpdate, () => {
          editingId = null
          resetForm()
        })}
      </div>
    </div>
  </div>
{/if}

<!-- Add Food Item modal -->
{#if addFoodOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" role="presentation" onclick={closeAddFood}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-label="Add food item from Open Food Facts" onclick={e => e.stopPropagation()}>
      <div class="modal-header">
        <h4>Add Food Item</h4>
        <button class="btn-text" onclick={closeAddFood}>Close</button>
      </div>
      <div class="add-food-search-wrap">
        <input
          class="add-food-search-input"
          type="text"
          placeholder="Search Open Food Facts..."
          value={addFoodQuery}
          oninput={handleAddFoodInput}
        />
      </div>
      <div class="add-food-results">
        {#if addFoodSearching}
          <p class="results-hint">Searching...</p>
        {:else if addFoodHasSearched && addFoodResults.length === 0}
          <p class="results-hint">No foods found</p>
        {:else if addFoodHasSearched}
          {@const libraryResults = addFoodResults.filter(f => f.source === "library")}
          {@const apiResults = addFoodResults.filter(f => f.source !== "library")}
          {#each libraryResults as food (food.id)}
            <div class="add-food-item in-library">
              <div class="add-food-info">
                <span class="add-food-name">{food.name}</span>
                {#if food.brand}
                  <span class="add-food-brand">{food.brand}</span>
                {/if}
              </div>
              <span class="in-library-badge">In library</span>
            </div>
          {/each}
          {#if apiResults.length > 0}
            {#if libraryResults.length > 0}
              <p class="section-divider">Open Food Facts</p>
            {/if}
            {#each apiResults as food (food.id)}
              <button class="add-food-item" onclick={() => addFoodFromResult(food)}>
                <div class="add-food-info">
                  <span class="add-food-name">{food.name}</span>
                  {#if food.brand}
                    <span class="add-food-brand">{food.brand}</span>
                  {/if}
                </div>
                <span class="add-food-cals">{food.calories} cal/srv</span>
              </button>
            {/each}
          {/if}
        {:else}
          <p class="results-hint">Search for foods to add to your library</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Food list -->
<section class="section">
  <div class="food-list">
    {#each filteredFoods as food (food.id)}
      <Card>
          <button class="food-row" onclick={() => (expandedId = expandedId === food.id ? null : food.id)}>
            <div class="food-top">
              <div class="food-info">
                <span class="food-name">{food.name}</span>
                {#if food.brand}
                  <span class="food-brand">{food.brand}</span>
                {/if}
                {#if food.categoryId}
                  {@const cat = categories.find((c: any) => c.id === food.categoryId)}
                  {#if cat}
                    <span class="food-brand">{cat.name}</span>
                  {/if}
                {/if}
              </div>
              <div class="food-meta">
                <span class="food-cals">{food.calories} cal / serving</span>
                <span class="source-badge">{SOURCE_LABELS[food.source] ?? food.source}</span>
              </div>
            </div>
          </button>

          {#if expandedId === food.id}
            <div class="food-detail">
              <div class="nutrient-grid">
                <div class="nutrient"><span class="nutrient-label">Protein</span><span>{food.protein}g</span></div>
                <div class="nutrient"><span class="nutrient-label">Net Carbs</span><span>{food.netCarbs}g</span></div>
                <div class="nutrient"><span class="nutrient-label">Fat</span><span>{food.fat}g</span></div>
                {#if food.saturatedFat != null}<div class="nutrient"><span class="nutrient-label">Saturated Fat</span><span>{food.saturatedFat}g</span></div>{/if}
                {#if food.transFat != null}<div class="nutrient"><span class="nutrient-label">Trans Fat</span><span>{food.transFat}g</span></div>{/if}
                {#if food.fiber != null}<div class="nutrient"><span class="nutrient-label">Fiber</span><span>{food.fiber}g</span></div>{/if}
                {#if food.addedSugars != null}<div class="nutrient"><span class="nutrient-label">Added Sugars</span><span>{food.addedSugars}g</span></div>{/if}
                {#if food.cholesterol != null}<div class="nutrient"><span class="nutrient-label">Cholesterol</span><span>{food.cholesterol}mg</span></div>{/if}
                {#if food.sodium != null}<div class="nutrient"><span class="nutrient-label">Sodium</span><span>{food.sodium}mg</span></div>{/if}
                {#if food.iron != null}<div class="nutrient"><span class="nutrient-label">Iron</span><span>{food.iron}mg</span></div>{/if}
                {#if food.calcium != null}<div class="nutrient"><span class="nutrient-label">Calcium</span><span>{food.calcium}mg</span></div>{/if}
                {#if food.magnesium != null}<div class="nutrient"><span class="nutrient-label">Magnesium</span><span>{food.magnesium}mg</span></div>{/if}
                {#if food.vitaminA != null}<div class="nutrient"><span class="nutrient-label">Vitamin A</span><span>{food.vitaminA}</span></div>{/if}
                {#if food.vitaminC != null}<div class="nutrient"><span class="nutrient-label">Vitamin C</span><span>{food.vitaminC}mg</span></div>{/if}
                {#if food.vitaminB12 != null}<div class="nutrient"><span class="nutrient-label">Vitamin B12</span><span>{food.vitaminB12}</span></div>{/if}
                {#if food.vitaminE != null}<div class="nutrient"><span class="nutrient-label">Vitamin E</span><span>{food.vitaminE}mg</span></div>{/if}
                {#if food.vitaminK != null}<div class="nutrient"><span class="nutrient-label">Vitamin K</span><span>{food.vitaminK}</span></div>{/if}
                {#if food.folate != null}<div class="nutrient"><span class="nutrient-label">Folate</span><span>{food.folate}</span></div>{/if}
                {#if food.potassium != null}<div class="nutrient"><span class="nutrient-label">Potassium</span><span>{food.potassium}mg</span></div>{/if}
                {#if food.zinc != null}<div class="nutrient"><span class="nutrient-label">Zinc</span><span>{food.zinc}mg</span></div>{/if}
              </div>
              <p class="serving-info">1 serving = {food.servingSize ?? 100}{food.baseUnit}</p>
              {#if food.barcode}
                <p class="serving-info">Barcode: {food.barcode}</p>
              {/if}
              {#if food.debug}
                <details class="debug-details">
                  <summary class="debug-summary">Debug JSON</summary>
                  <pre class="raw-json">{JSON.stringify(food.debug, null, 2)}</pre>
                </details>
              {/if}
              <div class="food-actions">
                {#if addedToDiaryId === food.id}
                  <span class="added-confirm">Added!</span>
                {:else}
                  <button class="btn-diary" onclick={() => addToDiary(food)}>Add to diary</button>
                {/if}
                <button class="btn-text" onclick={() => startEdit(food)}>Edit</button>
                {#if forceDeleteId === food.id}
                  <div class="confirm-delete-inline">
                    <span class="confirm-text">{forceDeleteMsg}</span>
                    <button class="confirm-btn yes" onclick={() => handleDelete(food.id, true)}>Yes</button>
                    <button class="confirm-btn no" onclick={() => (forceDeleteId = null)}>No</button>
                  </div>
                {:else if deletingId === food.id}
                  <div class="confirm-delete-inline">
                    <span class="confirm-text">Delete?</span>
                    <button class="confirm-btn yes" onclick={() => handleDelete(food.id)}>Yes</button>
                    <button class="confirm-btn no" onclick={() => (deletingId = null)}>No</button>
                  </div>
                {:else}
                  <button class="delete-btn-sm" onclick={() => (deletingId = food.id)}>Delete</button>
                {/if}
              </div>
            </div>
          {/if}
      </Card>
    {/each}

    {#if filteredFoods.length === 0}
      <p class="empty">No food items found</p>
    {/if}
  </div>
</section>

{#snippet foodForm(title: string, onsubmit: () => void, oncancel: () => void)}
  <div class="create-form">
    <h4>{title}</h4>
    <div class="form-fields">
      {#if fBarcode}
        <div class="form-field">
          <label class="field-label" for="food-barcode">Barcode</label>
          <input id="food-barcode" value={fBarcode} readonly class="readonly-input" />
        </div>
      {/if}
      <div class="form-field">
        <label class="field-label" for="food-name">Name</label>
        <input
          id="food-name"
          bind:value={fName}
          placeholder="e.g. Chicken breast"
          oninput={() => checkDuplicateName(fName)}
        />
      </div>
      {#if duplicateWarning}
        <p class="warning">{duplicateWarning}</p>
      {/if}
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-brand">Brand</label>
          <input id="food-brand" bind:value={fBrand} placeholder="Optional" />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-base">Base unit</label>
          <select id="food-base" bind:value={fBaseUnit}>
            <option value="g">Grams (g)</option>
            <option value="ml">Milliliters (ml)</option>
          </select>
        </div>
      </div>
      {#if categories.length > 0}
        <div class="form-field">
          <label class="field-label" for="food-category">Category</label>
          <select id="food-category" bind:value={fCategoryId}>
            <option value="">None</option>
            {#each categories as cat}
              <option value={cat.id}>{cat.name}</option>
            {/each}
          </select>
        </div>
      {/if}
      <div class="serving-row">
        <span class="serving-label">1 serving =</span>
        <div class="form-field serving-field">
          <input id="food-serving" type="number" bind:value={fServingSize} placeholder="100" />
        </div>
        <span class="serving-unit">{fBaseUnit}</span>
      </div>

      <h4 class="subsection">Nutrition (per serving)</h4>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-cal">Calories</label>
          <input id="food-cal" type="number" bind:value={fCalories} placeholder="0" />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-prot">Protein (g)</label>
          <input id="food-prot" type="number" bind:value={fProtein} placeholder="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-carb">Net Carbs (g)</label>
          <input id="food-carb" type="number" bind:value={fNetCarbs} placeholder="0" />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-fat">Fat (g)</label>
          <input id="food-fat" type="number" bind:value={fFat} placeholder="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-satfat">Saturated Fat (g)</label>
          <input id="food-satfat" type="number" bind:value={fSaturatedFat} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-transfat">Trans Fat (g)</label>
          <input id="food-transfat" type="number" bind:value={fTransFat} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-fiber">Fiber (g)</label>
          <input id="food-fiber" type="number" bind:value={fFiber} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-addsugars">Added Sugars (g)</label>
          <input id="food-addsugars" type="number" bind:value={fAddedSugars} />
        </div>
      </div>

      <h4 class="subsection">Micronutrients (optional)</h4>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-cholesterol">Cholesterol (mg)</label>
          <input id="food-cholesterol" type="number" bind:value={fCholesterol} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-sodium">Sodium (mg)</label>
          <input id="food-sodium" type="number" bind:value={fSodium} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-iron">Iron (mg)</label>
          <input id="food-iron" type="number" bind:value={fIron} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-calcium">Calcium (mg)</label>
          <input id="food-calcium" type="number" bind:value={fCalcium} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-magnesium">Magnesium (mg)</label>
          <input id="food-magnesium" type="number" bind:value={fMagnesium} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-va">Vitamin A</label>
          <input id="food-va" type="number" bind:value={fVitaminA} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-vc">Vitamin C (mg)</label>
          <input id="food-vc" type="number" bind:value={fVitaminC} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-b12">Vitamin B12</label>
          <input id="food-b12" type="number" bind:value={fVitaminB12} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-ve">Vitamin E (mg)</label>
          <input id="food-ve" type="number" bind:value={fVitaminE} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-vk">Vitamin K</label>
          <input id="food-vk" type="number" bind:value={fVitaminK} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-folate">Folate</label>
          <input id="food-folate" type="number" bind:value={fFolate} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-potassium">Potassium (mg)</label>
          <input id="food-potassium" type="number" bind:value={fPotassium} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-zinc">Zinc (mg)</label>
          <input id="food-zinc" type="number" bind:value={fZinc} />
        </div>
        <div class="form-field"></div>
      </div>
    </div>

    {#if formError}
      <p class="error">{formError}</p>
    {/if}

    <div class="form-actions">
      <Button variant="primary" onclick={onsubmit}>{editingId ? "Update" : "Create"}</Button>
      <button class="btn-text" onclick={oncancel}>Cancel</button>
    </div>
  </div>
{/snippet}

<style>
  .section {
    margin-bottom: var(--space-6);
  }

  /* Controls */
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }

  .search-row {
    display: flex;
    gap: var(--space-2);
    flex: 1;
    min-width: 200px;
    align-items: center;
  }

  .search-input {
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    outline: none;
  }

  .search-input:focus {
    border-color: var(--border-strong);
  }

  .search-input::placeholder {
    color: var(--ink-faint);
  }

  .icon-btn {
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
    flex-shrink: 0;
  }

  .icon-btn:hover {
    color: var(--ink);
    border-color: var(--border-strong);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .source-select {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    outline: none;
  }

  /* Modal */
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
    max-width: 480px;
    max-height: 85vh;
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
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
  }

  /* Add Food Item modal */
  .add-food-search-wrap {
    padding: var(--space-3) var(--space-5);
  }

  .add-food-search-input {
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

  .add-food-search-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .add-food-search-input::placeholder {
    color: var(--ink-faint);
  }

  .add-food-results {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0;
    min-height: 200px;
  }

  .results-hint {
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  .section-divider {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--ink-faint);
    padding: var(--space-3) var(--space-5) var(--space-1);
    margin: 0;
    border-top: 0.5px solid var(--border);
  }

  .add-food-item {
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

  .add-food-item:hover {
    background: var(--paper-warm);
  }

  .add-food-item.in-library {
    cursor: default;
    opacity: 0.6;
  }

  .add-food-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .add-food-name {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .add-food-brand {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .add-food-cals {
    font-size: var(--text-sm);
    color: var(--ink-light);
    white-space: nowrap;
  }

  .in-library-badge {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-style: italic;
  }

  /* Food list */
  .food-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .food-row {
    display: block;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    color: var(--ink);
    padding: 0;
  }

  .food-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .food-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .food-name {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .food-brand {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .food-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .food-cals {
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .source-badge {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--ink-light);
    background: var(--paper-warm);
  }

  /* Food detail */
  .food-detail {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 0.5px solid var(--border);
  }

  .nutrient-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-4);
  }

  .nutrient {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-sm);
  }

  .nutrient-label {
    color: var(--ink-faint);
  }

  .serving-info {
    font-size: var(--text-xs);
    color: var(--ink-faint);
    margin-bottom: var(--space-2);
  }

  .food-actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  /* Form */
  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .create-form h4 {
    margin: 0;
  }

  .serving-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .serving-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    white-space: nowrap;
  }

  .serving-field {
    max-width: 80px;
  }

  .serving-unit {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  .subsection {
    font-size: var(--text-base);
    margin: 0;
    padding-top: var(--space-2);
    border-top: 0.5px solid var(--border);
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

  .warning {
    font-size: var(--text-sm);
    color: var(--accent);
    opacity: 0.8;
  }

  .empty {
    font-size: var(--text-sm);
    color: var(--ink-faint);
    text-align: center;
    padding: var(--space-8) 0;
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

  .action-buttons {
    display: flex;
    gap: var(--space-3);
  }

  .debug-details {
    margin-top: var(--space-2);
  }

  .debug-summary {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    cursor: pointer;
    user-select: none;
  }

  .debug-summary:hover {
    color: var(--ink-light);
  }

  .scanner-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .scanner-card h4 {
    margin: 0;
  }

  .scanner-container {
    border-radius: var(--radius-sm);
    overflow: hidden;
    height: 300px;
  }

  .scan-message {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .scan-message .error {
    margin: 0;
  }

  .raw-json-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .raw-json-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .raw-json-header h4 {
    margin: 0;
  }

  .raw-json {
    font-family: monospace;
    font-size: var(--text-xs);
    color: var(--ink-light);
    background: var(--paper-warm);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }

  .btn-diary {
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

  .btn-diary:hover {
    background: var(--accent);
    color: white;
  }

  .added-confirm {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-light);
    padding: var(--space-2) var(--space-4);
  }

  .readonly-input {
    color: var(--ink-faint) !important;
    cursor: default !important;
  }
</style>
