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
  $effect(() => {
    foods = page.data.foods ?? []
  })

  let searchQuery = $state("")
  let sourceFilter = $state("")
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
  let fFiber = $state("")
  let fIron = $state("")
  let fCalcium = $state("")
  let fVitaminA = $state("")
  let fVitaminC = $state("")
  let fVitaminB12 = $state("")
  let fFolate = $state("")
  let fPotassium = $state("")

  const SOURCE_LABELS: Record<string, string> = {
    manual: "Manual",
    barcode: "Barcode",
    openfoodfacts: "OFF",
    usda: "USDA",
  }

  const filteredFoods = $derived(
    foods.filter((f: any) => {
      const matchesSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSource = !sourceFilter || f.source === sourceFilter
      return matchesSearch && matchesSource
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
        fFiber = d.fiber?.toString() ?? ""
        fIron = d.iron?.toString() ?? ""
        fCalcium = d.calcium?.toString() ?? ""
        fVitaminA = d.vitaminA?.toString() ?? ""
        fVitaminC = d.vitaminC?.toString() ?? ""
        fVitaminB12 = d.vitaminB12?.toString() ?? ""
        fFolate = d.folate?.toString() ?? ""
        fPotassium = d.potassium?.toString() ?? ""
        creating = true
        return
      }

      scanError = "No food found for this barcode"
    } catch {
      scanError = "Failed to look up barcode"
    }
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
    fFiber = ""
    fIron = ""
    fCalcium = ""
    fVitaminA = ""
    fVitaminC = ""
    fVitaminB12 = ""
    fFolate = ""
    fPotassium = ""
    formError = ""
    duplicateWarning = ""
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
      servingSize: numOrNull(fServingSize),
      calories: parseFloat(fCalories) || 0,
      protein: parseFloat(fProtein) || 0,
      netCarbs: parseFloat(fNetCarbs) || 0,
      fat: parseFloat(fFat) || 0,
      fiber: numOrNull(fFiber),
      iron: numOrNull(fIron),
      calcium: numOrNull(fCalcium),
      vitaminA: numOrNull(fVitaminA),
      vitaminC: numOrNull(fVitaminC),
      vitaminB12: numOrNull(fVitaminB12),
      folate: numOrNull(fFolate),
      potassium: numOrNull(fPotassium),
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
    fFiber = food.fiber?.toString() ?? ""
    fIron = food.iron?.toString() ?? ""
    fCalcium = food.calcium?.toString() ?? ""
    fVitaminA = food.vitaminA?.toString() ?? ""
    fVitaminC = food.vitaminC?.toString() ?? ""
    fVitaminB12 = food.vitaminB12?.toString() ?? ""
    fFolate = food.folate?.toString() ?? ""
    fPotassium = food.potassium?.toString() ?? ""
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
</script>

<PageHeader icon={icons.shoku} title="Food Library" subtitle="Your saved food items" />

<section class="controls">
  <div class="search-row">
    <input class="search-input" type="text" placeholder="Search foods..." bind:value={searchQuery} />
    <select class="source-select" bind:value={sourceFilter}>
      <option value="">All sources</option>
      <option value="manual">Manual</option>
      <option value="barcode">Barcode</option>
      <option value="openfoodfacts">Open Food Facts</option>
      <option value="usda">USDA</option>
    </select>
  </div>
  {#if !creating && !editingId && !scanning}
    <div class="action-buttons">
      <Button
        onclick={() => {
          creating = true
          resetForm()
        }}>New food item</Button
      >
      {#if scannerSupported}
        <Button variant="secondary" onclick={() => { scanning = true; scanError = ""; scanRawJson = null }}>Scan barcode</Button>
      {/if}
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

<!-- Edit form -->
{#if editingId}
  <section class="section">
    <Card>
      {@render foodForm("Edit Food Item", handleUpdate, () => {
        editingId = null
        resetForm()
      })}
    </Card>
  </section>
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
                {#if food.fiber != null}<div class="nutrient">
                    <span class="nutrient-label">Fiber</span><span>{food.fiber}g</span>
                  </div>{/if}
                {#if food.iron != null}<div class="nutrient">
                    <span class="nutrient-label">Iron</span><span>{food.iron}mg</span>
                  </div>{/if}
                {#if food.calcium != null}<div class="nutrient">
                    <span class="nutrient-label">Calcium</span><span>{food.calcium}mg</span>
                  </div>{/if}
                {#if food.vitaminA != null}<div class="nutrient">
                    <span class="nutrient-label">Vitamin A</span><span>{food.vitaminA}</span>
                  </div>{/if}
                {#if food.vitaminC != null}<div class="nutrient">
                    <span class="nutrient-label">Vitamin C</span><span>{food.vitaminC}mg</span>
                  </div>{/if}
                {#if food.vitaminB12 != null}<div class="nutrient">
                    <span class="nutrient-label">Vitamin B12</span><span>{food.vitaminB12}</span>
                  </div>{/if}
                {#if food.folate != null}<div class="nutrient">
                    <span class="nutrient-label">Folate</span><span>{food.folate}</span>
                  </div>{/if}
                {#if food.potassium != null}<div class="nutrient">
                    <span class="nutrient-label">Potassium</span><span>{food.potassium}mg</span>
                  </div>{/if}
              </div>
              <p class="serving-info">1 serving = {food.servingSize ?? 100}{food.baseUnit}</p>
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

      <h4 class="subsection">Micronutrients (optional)</h4>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-fiber">Fiber (g)</label>
          <input id="food-fiber" type="number" bind:value={fFiber} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-iron">Iron (mg)</label>
          <input id="food-iron" type="number" bind:value={fIron} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label class="field-label" for="food-calcium">Calcium (mg)</label>
          <input id="food-calcium" type="number" bind:value={fCalcium} />
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
          <label class="field-label" for="food-folate">Folate</label>
          <input id="food-folate" type="number" bind:value={fFolate} />
        </div>
        <div class="form-field">
          <label class="field-label" for="food-potassium">Potassium (mg)</label>
          <input id="food-potassium" type="number" bind:value={fPotassium} />
        </div>
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
    gap: var(--space-3);
    flex: 1;
    min-width: 200px;
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
