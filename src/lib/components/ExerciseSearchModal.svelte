<script lang="ts">
  import { Button } from "$lib/components"

  interface Props {
    open: boolean
    exercises: any[]
    onclose: () => void
    onadd: (exercise: {
      exerciseId: string
      targetSets: number
      targetReps: number
      targetWeight: number | null
      restSeconds: number
    }) => void
  }

  let { open, exercises, onclose, onadd }: Props = $props()

  let searchQuery = $state("")
  let regionFilter = $state("")
  let muscleFilter = $state("")
  let equipmentFilter = $state("")
  let selectedExerciseId = $state<string | null>(null)
  let targetSets = $state("3")
  let targetReps = $state("10")
  let targetWeight = $state("")
  let restSeconds = $state("90")

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

  const allMuscles = $derived(
    regionFilter
      ? (MUSCLES_BY_REGION[regionFilter] ?? [])
      : Object.values(MUSCLES_BY_REGION).flat(),
  )

  $effect(() => {
    if (regionFilter && muscleFilter) {
      const muscles = MUSCLES_BY_REGION[regionFilter] ?? []
      if (!muscles.some((m) => m.value === muscleFilter)) {
        muscleFilter = ""
      }
    }
  })

  const filteredExercises = $derived(
    exercises.filter((e: any) => {
      const matchesSearch =
        !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRegion = !regionFilter || e.muscleGroup.region === regionFilter
      const matchesMuscle = !muscleFilter || e.muscleGroup.muscle === muscleFilter
      const matchesEquipment = !equipmentFilter || e.equipment === equipmentFilter
      return matchesSearch && matchesRegion && matchesMuscle && matchesEquipment
    }),
  )

  const selectedExercise = $derived(
    exercises.find((e: any) => e.id === selectedExerciseId),
  )

  function reset() {
    searchQuery = ""
    regionFilter = ""
    muscleFilter = ""
    equipmentFilter = ""
    selectedExerciseId = null
    targetSets = "3"
    targetReps = "10"
    targetWeight = ""
    restSeconds = "90"
  }

  function handleClose() {
    reset()
    onclose()
  }

  function handleAdd() {
    if (!selectedExerciseId) return
    onadd({
      exerciseId: selectedExerciseId,
      targetSets: parseInt(targetSets) || 3,
      targetReps: parseInt(targetReps) || 10,
      targetWeight: targetWeight ? parseFloat(targetWeight) : null,
      restSeconds: parseInt(restSeconds) || 90,
    })
    reset()
  }

  function formatMuscle(muscle: string): string {
    return muscle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function formatEquipment(equip: string): string {
    return equip.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" role="presentation" onclick={handleClose}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="modal" role="dialog" aria-label="Search exercises" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h4>Add Exercise</h4>
        <button class="btn-text" onclick={handleClose}>Close</button>
      </div>

      <div class="search-section">
        <input
          class="search-input"
          type="text"
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
            {#each allMuscles as m}
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
      </div>

      <div class="results">
        {#if filteredExercises.length === 0}
          <p class="results-hint">No exercises found</p>
        {/if}
        {#each filteredExercises as ex (ex.id)}
          <button
            class="result-item"
            class:selected={selectedExerciseId === ex.id}
            onclick={() => (selectedExerciseId = ex.id)}
          >
            <div class="result-info">
              <span class="result-name">{ex.name}</span>
              <span class="result-meta">{formatMuscle(ex.muscleGroup.muscle)} · {formatEquipment(ex.equipment)}</span>
            </div>
          </button>
        {/each}
      </div>

      {#if selectedExercise}
        <div class="config-section">
          <div class="config-header">
            <span class="config-exercise-name">{selectedExercise.name}</span>
          </div>
          <div class="config-row">
            <div class="config-field">
              <label class="field-label">Sets</label>
              <input type="number" class="field-input" bind:value={targetSets} min="1" />
            </div>
            <div class="config-field">
              <label class="field-label">Reps</label>
              <input type="number" class="field-input" bind:value={targetReps} min="1" />
            </div>
            <div class="config-field">
              <label class="field-label">Weight (lbs)</label>
              <input type="number" class="field-input" bind:value={targetWeight} placeholder="opt" />
            </div>
            <div class="config-field">
              <label class="field-label">Rest (s)</label>
              <input type="number" class="field-input" bind:value={restSeconds} min="0" />
            </div>
          </div>
          <div class="config-actions">
            <Button variant="primary" onclick={handleAdd}>Add Exercise</Button>
          </div>
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
    max-width: 560px;
    height: 85vh;
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
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    margin: 0;
    color: var(--ink);
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

  .search-section {
    padding: var(--space-3) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    border-bottom: 0.5px solid var(--border);
  }

  .search-input {
    width: 100%;
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    outline: none;
  }

  .search-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .search-input::placeholder {
    color: var(--ink-faint);
  }

  .filter-row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .filter-select {
    flex: 1;
    min-width: 0;
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--ink-light);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    outline: none;
  }

  .filter-select:focus {
    border-color: var(--border-strong);
  }

  .results {
    flex: 1;
    overflow-y: auto;
    min-height: 120px;
  }

  .results-hint {
    padding: var(--space-4) var(--space-5);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-faint);
  }

  .result-item {
    display: flex;
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

  .result-item.selected {
    background: var(--paper-warm);
    border-left: 2px solid var(--accent);
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

  .result-meta {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .config-section {
    padding: var(--space-3) var(--space-5) var(--space-4);
    border-top: 0.5px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .config-header {
    display: flex;
    align-items: center;
  }

  .config-exercise-name {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
  }

  .config-row {
    display: flex;
    gap: var(--space-3);
  }

  .config-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  .field-label {
    font-family: var(--font-body);
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
  }

  .field-input:focus {
    border-bottom-color: var(--border-strong);
  }

  .config-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
