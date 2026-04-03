<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader, StatNumber } from "$lib/components"
  import { icons } from "$lib/icons"
  import FoodSearchModal from "$lib/components/FoodSearchModal.svelte"
  import { journeyLens } from "$lib/stores/journeyLens.svelte"

  let grouped = $state(page.data.grouped ?? {})
  let totals = $state(page.data.totals ?? { calories: 0, protein: 0, netCarbs: 0, fat: 0 })
  let currentDate = $state(page.data.date ?? new Date().toISOString().split("T")[0])
  let waterOunces = $state(page.data.waterOunces ?? 0)

  $effect(() => {
    grouped = page.data.grouped ?? {}
    totals = page.data.totals ?? { calories: 0, protein: 0, netCarbs: 0, fat: 0 }
    currentDate = page.data.date ?? new Date().toISOString().split("T")[0]
    waterOunces = page.data.waterOunces ?? 0
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

  // Expanded categories
  let expandedEmpty = $state<Set<string>>(new Set())

  const CATEGORIES = [
    { key: "breakfast", label: "Breakfast" },
    { key: "lunch", label: "Lunch" },
    { key: "dinner", label: "Dinner" },
    { key: "snack", label: "Snack" },
    { key: "uncategorized", label: "Uncategorized" },
  ]

  function navigateDate(dateStr: string) {
    const params = new URLSearchParams()
    params.set("date", dateStr)
    if (journeyLens.selectedId) params.set("journeyId", journeyLens.selectedId)
    goto(`/shoku?${params.toString()}`, { invalidateAll: true })
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

  function handleCreateFood() {
    searchOpen = false
    goto("/shoku/library?create=1")
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
        unit: "serving",
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

  function toggleEmptyCategory(key: string) {
    const next = new Set(expandedEmpty)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedEmpty = next
  }

  // Re-navigate when journey lens changes
  $effect(() => {
    const lensId = journeyLens.selectedId
    const params = new URLSearchParams()
    params.set("date", currentDate)
    if (lensId) params.set("journeyId", lensId)
    // Only re-navigate if the URL params actually differ
    const currentJourneyId = page.url.searchParams.get("journeyId")
    if ((lensId ?? null) !== (currentJourneyId ?? null)) {
      goto(`/shoku?${params.toString()}`, { invalidateAll: true })
    }
  })
</script>

<PageHeader icon={icons.shoku} title="Shoku" subtitle="Nourish with intention" />

<!-- Date picker -->
<section class="date-nav">
  <button class="date-btn" onclick={prevDay}>&larr;</button>
  <input
    type="date"
    class="date-input"
    value={currentDate}
    onchange={e => navigateDate((e.target as HTMLInputElement).value)}
  />
  <button class="date-btn" onclick={nextDay}>&rarr;</button>
  <button class="btn-quick" onclick={() => (quickAddOpen = !quickAddOpen)}>Quick add</button>
</section>

<!-- Macro summary -->
<section class="macro-bar">
  <Card>
    <div class="macro-grid">
      <StatNumber value={totals.calories.toString()} label="Calories" size="sm" />
      <StatNumber value={`${totals.protein}g`} label="Protein" size="sm" />
      <StatNumber value={`${totals.netCarbs}g`} label="Net Carbs" size="sm" />
      <StatNumber value={`${totals.fat}g`} label="Fat" size="sm" />
    </div>
  </Card>
</section>

<!-- Quick add form -->
{#if quickAddOpen}
  <section class="section">
    <Card>
      <div class="quick-form">
        <h4>Quick Add</h4>
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
    </Card>
  </section>
{/if}

<!-- Category sections -->
{#each CATEGORIES as cat (cat.key)}
  {@const entries = grouped[cat.key] ?? []}
  <section class="section">
    <div class="category-header">
      {#if entries.length === 0}
        <button
          class="btn-chevron"
          onclick={() => toggleEmptyCategory(cat.key)}
          aria-label="{expandedEmpty.has(cat.key) ? 'Collapse' : 'Expand'} {cat.label}"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class:chevron-open={expandedEmpty.has(cat.key)}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      {/if}
      <h3>{cat.label}</h3>
      <button class="btn-add" onclick={() => openSearch(cat.key)}>+</button>
    </div>

    {#if entries.length > 0 || expandedEmpty.has(cat.key)}
      <div class="entries-stack">
        {#each entries as entry (entry.id)}
          <Card>
            {#if deletingId === entry.id}
              <div class="delete-confirm">
                <p class="delete-msg">Remove this entry from your diary?</p>
                <div class="form-actions">
                  <button class="btn-danger" onclick={() => deleteEntry(entry.id)}>Delete</button>
                  <button class="btn-text" onclick={() => (deletingId = null)}>Cancel</button>
                </div>
              </div>
            {:else if editingId === entry.id}
              <div class="edit-form">
                <div class="form-row">
                  <div class="form-field">
                    <label class="field-label" for="edit-qty">Servings</label>
                    <input id="edit-qty" type="number" min="0.1" step="any" bind:value={editQuantity} />
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
                  <button
                    class="btn-text btn-danger-text"
                    onclick={() => {
                      editingId = null
                      deletingId = entry.id
                    }}>Delete</button
                  >
                </div>
              </div>
            {:else}
              <button class="entry-row" onclick={() => startEdit(entry)}>
                <span class="entry-name">{entry.foodName}</span>
                <span class="entry-servings">{entry.quantity} {entry.quantity === 1 ? 'serving' : 'servings'}</span>
                <span class="entry-cals">{entry.calculatedCalories} cal</span>
              </button>
            {/if}
          </Card>
        {/each}
        {#if entries.length === 0}
          <p class="empty-cat">No entries yet</p>
        {/if}
      </div>
    {/if}
  </section>
{/each}

<!-- Water tracking -->
<section class="section">
  <div class="category-header">
    <h3>Water</h3>
  </div>
  <Card>
    <div class="water-section">
      <span class="water-total">{waterOunces} oz</span>
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
  oncreate={handleCreateFood}
/>

<style>
  .section {
    margin-bottom: var(--space-6);
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

  .btn-chevron {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    color: var(--ink-faint);
    transition: color var(--transition-fast);
  }

  .btn-chevron:hover {
    color: var(--ink-light);
  }

  .btn-chevron svg {
    transition: transform var(--transition-fast);
  }

  :global(.chevron-open) {
    transform: rotate(90deg);
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
  .edit-form,
  .quick-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .quick-form h4 {
    margin: 0;
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

  .delete-confirm {
    padding: var(--space-2);
  }

  .delete-msg {
    font-size: var(--text-sm);
    color: var(--ink-light);
    margin-bottom: var(--space-4);
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
  }

  .btn-danger:hover {
    opacity: 0.9;
  }

  .btn-danger-text {
    color: var(--accent);
  }

  .btn-danger-text:hover {
    opacity: 0.8;
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
