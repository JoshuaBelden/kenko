<script lang="ts">
  type SortKey = "protein" | "netCarbs" | "fat" | "name"

  interface Props {
    open: boolean
    initialSort: SortKey
    excludeIds: string[]
    onselect: (food: any) => void
    onsearch: () => void
    onclose: () => void
  }

  let { open, initialSort, excludeIds, onselect, onsearch, onclose }: Props = $props()

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "protein", label: "Protein" },
    { key: "netCarbs", label: "Carbs" },
    { key: "fat", label: "Fat" },
    { key: "name", label: "Name" },
  ]

  let library = $state<any[]>([])
  let loading = $state(false)
  let loaded = $state(false)
  let sortKey = $state<SortKey>("protein")
  let searchQuery = $state("")
  let searchInput = $state<HTMLInputElement | null>(null)

  async function loadLibrary() {
    loading = true
    const res = await fetch("/api/shoku/foods")
    if (res.ok) {
      library = await res.json()
      loaded = true
    }
    loading = false
  }

  $effect(() => {
    if (open) {
      searchQuery = ""
      sortKey = initialSort
      if (!loaded) loadLibrary()
      requestAnimationFrame(() => searchInput?.focus())
    }
  })

  const visibleFoods = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase()
    const excluded = new Set(excludeIds)
    const filtered = library.filter((f) => {
      if (excluded.has(f.id)) return false
      if (!query) return true
      return f.name?.toLowerCase().includes(query) || f.brand?.toLowerCase().includes(query)
    })
    if (sortKey === "name") return filtered.sort((a, b) => a.name.localeCompare(b.name))
    return filtered.sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0) || a.name.localeCompare(b.name))
  })

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && visibleFoods.length === 1) {
      onselect(visibleFoods[0])
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="picker-backdrop" role="presentation" onclick={onclose}>
    <!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
    <div class="picker" role="dialog" aria-label="Select food from library" onclick={(e) => e.stopPropagation()}>
      <div class="picker-header">
        <h4>Add from Library</h4>
        <button class="btn-close" onclick={onclose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="picker-controls">
        <input
          class="search-input"
          type="text"
          placeholder="Filter foods..."
          bind:value={searchQuery}
          bind:this={searchInput}
          onkeydown={handleSearchKeydown}
        />
        <div class="sort-toggle" role="group" aria-label="Sort by">
          {#each SORT_OPTIONS as opt}
            <button
              class="sort-btn"
              class:sort-btn-active={sortKey === opt.key}
              onclick={() => (sortKey = opt.key)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      {#if loading}
        <div class="picker-empty"><p>Loading library...</p></div>
      {:else if visibleFoods.length === 0}
        <div class="picker-empty">
          <p>{searchQuery ? "No matching foods in your library." : "No foods in your library yet."}</p>
        </div>
      {:else}
        <div class="picker-list">
          {#each visibleFoods as food (food.id)}
            <button class="picker-item" onclick={() => onselect(food)}>
              <span class="picker-item-name">
                {food.name}
                <span class="picker-item-serving">{food.servingSize ?? 100}{food.baseUnit} / serving</span>
              </span>
              <span class="picker-item-macros">
                <span class:macro-sorted={sortKey === "protein"}>{Math.round(food.protein)}P</span>
                <span class:macro-sorted={sortKey === "netCarbs"}>{Math.round(food.netCarbs)}C</span>
                <span class:macro-sorted={sortKey === "fat"}>{Math.round(food.fat)}F</span>
                <span>{Math.round(food.calories)} cal</span>
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="picker-footer">
        <button class="link-btn" onclick={onsearch}>Search or scan for a new food</button>
      </div>
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
    max-width: 480px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    border-bottom: 0.5px solid var(--border);
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

  .picker-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
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

  .sort-toggle {
    display: flex;
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .sort-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--ink-faint);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .sort-btn-active {
    background: var(--accent);
    color: #fff;
  }

  .picker-empty {
    padding: var(--space-6);
    text-align: center;
    color: var(--ink-faint);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .picker-list {
    padding: 0 var(--space-3) var(--space-3);
    overflow-y: auto;
    flex: 1;
    min-height: 0;
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
    display: flex;
    flex-direction: column;
    font-size: var(--text-sm);
    color: var(--ink);
    text-align: left;
    flex: 1;
    min-width: 0;
  }

  .picker-item-serving {
    font-size: var(--text-xs);
    color: var(--ink-faint);
  }

  .picker-item-macros {
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    white-space: nowrap;
    margin-left: var(--space-2);
  }

  .macro-sorted {
    color: var(--ink);
    font-weight: 600;
  }

  .picker-footer {
    padding: var(--space-3) var(--space-4);
    border-top: 0.5px solid var(--border);
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--accent);
    cursor: pointer;
  }

  .link-btn:hover {
    text-decoration: underline;
  }
</style>
