<script lang="ts">
  import { invalidateAll } from "$app/navigation"
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"

  let exercises = $state(page.data.exercises ?? [])
  $effect(() => {
    exercises = page.data.exercises ?? []
  })

  let searchQuery = $state("")
  let regionFilter = $state("")
  let muscleFilter = $state("")
  let equipmentFilter = $state("")
  let creating = $state(false)
  let editingId = $state<string | null>(null)
  let deletingId = $state<string | null>(null)
  let formError = $state("")

  // Form fields
  let fName = $state("")
  let fRegion = $state<string>("torso")
  let fMuscle = $state<string>("chest")
  let fEquipment = $state<string>("barbell")

  const REGIONS: { value: string; label: string }[] = [
    { value: "torso", label: "Torso" },
    { value: "arms", label: "Arms" },
    { value: "lower_body", label: "Lower Body" },
  ]

  const MUSCLES_BY_REGION: Record<string, { value: string; label: string }[]> = {
    torso: [
      { value: "chest", label: "Chest" },
      { value: "abs", label: "Abs" },
      { value: "back", label: "Back" },
      { value: "lower_back", label: "Lower Back" },
      { value: "trapezius", label: "Trapezius" },
      { value: "neck", label: "Neck" },
    ],
    arms: [
      { value: "shoulders", label: "Shoulders" },
      { value: "biceps", label: "Biceps" },
      { value: "triceps", label: "Triceps" },
      { value: "forearms", label: "Forearms" },
    ],
    lower_body: [
      { value: "glutes", label: "Glutes" },
      { value: "quads", label: "Quads" },
      { value: "hamstrings", label: "Hamstrings" },
      { value: "calves", label: "Calves" },
      { value: "abductors", label: "Abductors" },
      { value: "adductors", label: "Adductors" },
    ],
  }

  const EQUIPMENT: { value: string; label: string }[] = [
    { value: "barbell", label: "Barbell" },
    { value: "dumbbell", label: "Dumbbell" },
    { value: "cable", label: "Cable" },
    { value: "machine", label: "Machine" },
    { value: "resistance_band", label: "Band" },
    { value: "bodyweight", label: "Bodyweight" },
    { value: "other", label: "Other" },
  ]

  const availableMuscles = $derived(MUSCLES_BY_REGION[fRegion] ?? [])

  // When region changes, reset muscle to first in region
  $effect(() => {
    const muscles = MUSCLES_BY_REGION[fRegion]
    if (muscles && !muscles.some(m => m.value === fMuscle)) {
      fMuscle = muscles[0]?.value ?? ""
    }
  })

  const filteredExercises = $derived(
    exercises.filter((e: any) => {
      const matchesSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRegion = !regionFilter || e.muscleGroup.region === regionFilter
      const matchesMuscle = !muscleFilter || e.muscleGroup.muscle === muscleFilter
      const matchesEquipment = !equipmentFilter || e.equipment === equipmentFilter
      return matchesSearch && matchesRegion && matchesMuscle && matchesEquipment
    }),
  )

  // Group by region for display
  const grouped = $derived(() => {
    const groups: Record<string, any[]> = { torso: [], arms: [], lower_body: [] }
    for (const e of filteredExercises) {
      const region = e.muscleGroup?.region ?? "torso"
      if (groups[region]) groups[region].push(e)
    }
    return groups
  })

  function resetForm() {
    fName = ""
    fRegion = "torso"
    fMuscle = "chest"
    fEquipment = "barbell"
    formError = ""
  }

  function startEdit(exercise: any) {
    editingId = exercise.id
    fName = exercise.name
    fRegion = exercise.muscleGroup.region
    fMuscle = exercise.muscleGroup.muscle
    fEquipment = exercise.equipment
    formError = ""
    creating = false
  }

  function muscleLabel(muscle: string): string {
    return muscle.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  function equipmentLabel(eq: string): string {
    return eq.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  function regionLabel(region: string): string {
    return region.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  async function handleCreate() {
    if (!fName.trim()) {
      formError = "Name is required"
      return
    }

    const res = await fetch("/api/dojo/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fName.trim(),
        muscleGroup: { region: fRegion, muscle: fMuscle },
        equipment: fEquipment,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      formError = data.error ?? "Failed to create exercise"
      return
    }

    creating = false
    resetForm()
    await invalidateAll()
  }

  async function handleUpdate() {
    if (!fName.trim()) {
      formError = "Name is required"
      return
    }

    const res = await fetch(`/api/dojo/exercises/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fName.trim(),
        muscleGroup: { region: fRegion, muscle: fMuscle },
        equipment: fEquipment,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      formError = data.error ?? "Failed to update exercise"
      return
    }

    editingId = null
    resetForm()
    await invalidateAll()
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/dojo/exercises/${id}`, { method: "DELETE" })
    if (res.status === 409) {
      const data = await res.json()
      formError = data.error
      deletingId = null
      return
    }
    deletingId = null
    await invalidateAll()
  }
</script>

<PageHeader kanji="道場" title="Exercise Library" subtitle="Your exercise catalog" />

<div class="library-controls">
  <input
    type="text"
    class="search-input"
    placeholder="Search exercises..."
    bind:value={searchQuery}
  />

  <div class="filter-row">
    <select class="filter-select" bind:value={regionFilter}>
      <option value="">All Regions</option>
      {#each REGIONS as r}
        <option value={r.value}>{r.label}</option>
      {/each}
    </select>

    <select class="filter-select" bind:value={muscleFilter}>
      <option value="">All Muscles</option>
      {#each regionFilter ? (MUSCLES_BY_REGION[regionFilter] ?? []) : Object.values(MUSCLES_BY_REGION).flat() as m}
        <option value={m.value}>{m.label}</option>
      {/each}
    </select>

    <select class="filter-select" bind:value={equipmentFilter}>
      <option value="">All Equipment</option>
      {#each EQUIPMENT as e}
        <option value={e.value}>{e.label}</option>
      {/each}
    </select>
  </div>

  {#if !creating && !editingId}
    <Button variant="primary" onclick={() => { creating = true; resetForm() }}>+ New Exercise</Button>
  {/if}
</div>

{#if creating || editingId}
  <Card>
    <div class="form">
      <h3 class="form-title">{creating ? "New Exercise" : "Edit Exercise"}</h3>

      <div class="form-field">
        <label class="field-label">Name</label>
        <input type="text" class="field-input" bind:value={fName} placeholder="e.g. Bench Press" />
      </div>

      <div class="form-row">
        <div class="form-field">
          <label class="field-label">Region</label>
          <select class="field-input" bind:value={fRegion}>
            {#each REGIONS as r}
              <option value={r.value}>{r.label}</option>
            {/each}
          </select>
        </div>

        <div class="form-field">
          <label class="field-label">Muscle</label>
          <select class="field-input" bind:value={fMuscle}>
            {#each availableMuscles as m}
              <option value={m.value}>{m.label}</option>
            {/each}
          </select>
        </div>

        <div class="form-field">
          <label class="field-label">Equipment</label>
          <select class="field-input" bind:value={fEquipment}>
            {#each EQUIPMENT as e}
              <option value={e.value}>{e.label}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if formError}
        <p class="form-error">{formError}</p>
      {/if}

      <div class="form-actions">
        <Button variant="secondary" onclick={() => { creating = false; editingId = null; resetForm() }}>Cancel</Button>
        <Button variant="primary" onclick={creating ? handleCreate : handleUpdate}>
          {creating ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  </Card>
{/if}

{#each Object.entries(grouped()) as [region, items]}
  {#if items.length > 0}
    <div class="region-group">
      <h3 class="region-title">{regionLabel(region)}</h3>
      {#each items as exercise (exercise.id)}
        <Card>
          <div class="exercise-item">
            <div class="exercise-info">
              <span class="exercise-name">{exercise.name}</span>
              <div class="exercise-meta">
                <span class="badge muscle">{muscleLabel(exercise.muscleGroup.muscle)}</span>
                <span class="badge equipment">{equipmentLabel(exercise.equipment)}</span>
              </div>
            </div>

            {#if deletingId === exercise.id}
              <div class="confirm-delete">
                <span class="confirm-text">Delete?</span>
                <Button variant="secondary" onclick={() => (deletingId = null)}>No</Button>
                <Button variant="primary" onclick={() => handleDelete(exercise.id)}>Yes</Button>
              </div>
            {:else}
              <div class="exercise-actions">
                <button class="action-btn" onclick={() => startEdit(exercise)}>Edit</button>
                <button class="action-btn delete" onclick={() => (deletingId = exercise.id)}>Delete</button>
              </div>
            {/if}
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{/each}

{#if filteredExercises.length === 0 && !creating}
  <div class="empty-state">
    <p>No exercises found. Create your first exercise to get started.</p>
  </div>
{/if}

<style>
  .library-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
  }

  .search-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-3);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .search-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .filter-row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: var(--space-2) var(--space-3);
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--ink);
    cursor: pointer;
  }

  .region-group {
    margin-bottom: var(--space-6);
  }

  .region-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-light);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: var(--space-3);
  }

  .exercise-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .exercise-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .exercise-name {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .exercise-meta {
    display: flex;
    gap: var(--space-2);
  }

  .badge {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--paper-warm);
    color: var(--ink-light);
  }

  .badge.equipment {
    background: var(--paper);
    border: 0.5px solid var(--border);
  }

  .exercise-actions {
    display: flex;
    gap: var(--space-2);
  }

  .action-btn {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    background: none;
    border: none;
    color: var(--ink-faint);
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .action-btn:hover {
    color: var(--ink);
  }

  .action-btn.delete:hover {
    color: var(--accent);
  }

  .confirm-delete {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  .field-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--ink-faint);
  }

  .field-input {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    padding: var(--space-2) 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    outline: none;
    transition: border-color var(--transition-fast);
  }

  .field-input:focus {
    border-bottom-color: var(--border-strong);
  }

  select.field-input {
    padding: var(--space-2) var(--space-1);
    cursor: pointer;
  }

  .form-row {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .form-error {
    font-size: var(--text-sm);
    color: var(--accent);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }
</style>
