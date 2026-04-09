<script lang="ts">
  import { Button, Card } from "$lib/components"
  import SettingsGeneral from "./SettingsGeneral.svelte"
  import SettingsShoku from "./SettingsShoku.svelte"
  import SettingsDanjiki from "./SettingsDanjiki.svelte"
  import SettingsDojo from "./SettingsDojo.svelte"
  import SettingsKata from "./SettingsKata.svelte"

  interface Props {
    // General
    name: string
    description: string
    statement: string | null
    startDate: string
    startTime: string
    endDate: string
    endTime: string
    // Shoku
    journeyId: string
    tdee: number | null
    weightGoalLbsPerWeek: string
    dailyCalorieOverride: boolean
    dailyCalorieTarget: string
    macroMode: "percentage" | "grams"
    proteinValue: string
    carbsValue: string
    fatValue: string
    dailyWaterTargetOz: string
    mealPlanItems: any[]
    mealBuilds: any[]
    mealPlanFoods: any[]
    categories: any[]
    // Danjiki
    weeklyFastingHours: string
    // Dojo
    allPlans: any[]
    selectedPlanIds: string[]
    dojoSessionsPerWeek: string
    dojoWeeklyCalorieBurn: string
    // Kata
    allCommitments: any[]
    selectedCommitmentIds: string[]
    // Actions
    saving: boolean
    saveError: string
    saveSuccess: boolean
    isArchived: boolean
    onchange: (field: string, value: any) => void
    onsave: () => void
    onclose: () => void
    onarchive: () => void
    onunarchive: () => void
    ondelete: () => void
  }

  let {
    name, description, statement, startDate, startTime, endDate, endTime,
    journeyId, tdee, weightGoalLbsPerWeek, dailyCalorieOverride, dailyCalorieTarget,
    macroMode, proteinValue, carbsValue, fatValue, dailyWaterTargetOz,
    mealPlanItems, mealBuilds, mealPlanFoods, categories,
    weeklyFastingHours,
    allPlans, selectedPlanIds, dojoSessionsPerWeek, dojoWeeklyCalorieBurn,
    allCommitments, selectedCommitmentIds,
    saving, saveError, saveSuccess, isArchived,
    onchange, onsave, onclose, onarchive, onunarchive, ondelete,
  }: Props = $props()

  type SettingsTab = "general" | "shoku" | "danjiki" | "dojo" | "kata"
  let activeTab = $state<SettingsTab>("general")

  let confirmingArchive = $state(false)
  let confirmingDelete = $state(false)

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "shoku", label: "Shoku" },
    { key: "danjiki", label: "Danjiki" },
    { key: "dojo", label: "Dojo" },
    { key: "kata", label: "Kata" },
  ]
</script>

<div class="settings-panel">
  <h2 class="section-title">Journey Settings</h2>

  <nav class="settings-tab-nav">
    {#each TABS as tab}
      <button
        class="settings-tab"
        class:settings-tab-active={activeTab === tab.key}
        onclick={() => (activeTab = tab.key)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  {#if activeTab === "general"}
    <SettingsGeneral
      {name} {description} {statement}
      {startDate} {startTime} {endDate} {endTime}
      {onchange}
    />

    <!-- Danger Zone -->
    <div class="danger-zone">
      {#if isArchived}
        <button class="btn-text" onclick={onunarchive}>Unarchive this journey</button>
      {:else if confirmingArchive}
        <Card>
          <div class="delete-confirm">
            <p class="delete-message">Archive this journey? It will be hidden from your journey list but can be restored later.</p>
            <div class="delete-actions">
              <button class="btn-danger" onclick={onarchive}>Yes, archive</button>
              <button class="btn-text" onclick={() => (confirmingArchive = false)}>Cancel</button>
            </div>
          </div>
        </Card>
      {:else}
        <button class="btn-text btn-danger-text" onclick={() => (confirmingArchive = true)}>Archive this journey</button>
      {/if}
    </div>

    <div class="danger-zone">
      {#if confirmingDelete}
        <Card>
          <div class="delete-confirm">
            <p class="delete-message">Are you sure? This will not delete any logged data — only the journey and its targets will be removed.</p>
            <div class="delete-actions">
              <button class="btn-danger" onclick={ondelete}>Yes, delete</button>
              <button class="btn-text" onclick={() => (confirmingDelete = false)}>Cancel</button>
            </div>
          </div>
        </Card>
      {:else}
        <button class="btn-text btn-danger-text" onclick={() => (confirmingDelete = true)}>Delete this journey</button>
      {/if}
    </div>
  {/if}

  {#if activeTab === "shoku"}
    <SettingsShoku
      {journeyId} {tdee}
      {weightGoalLbsPerWeek} {dailyCalorieOverride} {dailyCalorieTarget}
      {macroMode} {proteinValue} {carbsValue} {fatValue}
      {dailyWaterTargetOz}
      {mealPlanItems} {mealBuilds} {mealPlanFoods} {categories}
      {onchange}
    />
  {/if}

  {#if activeTab === "danjiki"}
    <SettingsDanjiki {weeklyFastingHours} {onchange} />
  {/if}

  {#if activeTab === "dojo"}
    <SettingsDojo
      {allPlans} {selectedPlanIds}
      sessionsPerWeek={dojoSessionsPerWeek}
      weeklyCalorieBurn={dojoWeeklyCalorieBurn}
      {onchange}
    />
  {/if}

  {#if activeTab === "kata"}
    <SettingsKata {allCommitments} {selectedCommitmentIds} {onchange} />
  {/if}

  <div class="settings-actions">
    <Button variant="primary" onclick={onsave} disabled={saving}>
      {saving ? "Saving..." : "Save settings"}
    </Button>
    <button class="btn-text" onclick={onclose}>Close settings</button>
    {#if saveError}
      <p class="form-error">{saveError}</p>
    {/if}
    {#if saveSuccess}
      <p class="form-success">Settings saved.</p>
    {/if}
  </div>
</div>

<style>
  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: 100%;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .settings-tab-nav {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border);
  }

  .settings-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .settings-tab:hover {
    color: var(--ink-light);
  }

  .settings-tab-active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  .settings-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }

  .form-error {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
    margin: 0;
  }

  .form-success {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent-green);
    margin: 0;
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

  .danger-zone {
    padding-top: var(--space-4);
    border-top: 0.5px solid var(--border);
  }

  .btn-danger-text {
    color: var(--accent);
  }

  .btn-danger-text:hover {
    opacity: 0.8;
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .delete-message {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-light);
    margin: 0;
  }

  .delete-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
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
    transition: opacity var(--transition-fast);
  }

  .btn-danger:hover {
    opacity: 0.9;
  }
</style>
