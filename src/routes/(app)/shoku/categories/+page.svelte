<script lang="ts">
  import { page } from "$app/state"
  import { Button, Card, PageHeader } from "$lib/components"

  const data = $derived(page.data as any)
  let categories = $state<any[]>([])

  $effect(() => {
    categories = data.categories ?? []
  })

  // New / edit form state
  let editingId = $state<string | null>(null)
  let formName = $state("")
  let saving = $state(false)
  let error = $state("")

  function startCreate() {
    editingId = null
    formName = ""
    error = ""
  }

  function startEdit(cat: any) {
    editingId = cat.id
    formName = cat.name
    error = ""
  }

  function cancelEdit() {
    editingId = null
    formName = ""
    error = ""
    showForm = false
  }

  let showForm = $state(false)

  async function save() {
    if (!formName.trim()) {
      error = "Name is required."
      return
    }

    saving = true
    error = ""

    if (editingId) {
      const res = await fetch(`/api/shoku/categories/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      })
      if (!res.ok) {
        error = (await res.json()).error ?? "Failed to update."
      } else {
        const updated = await res.json()
        categories = categories.map((c) => (c.id === editingId ? updated : c))
        editingId = null
        formName = ""
        showForm = false
      }
    } else {
      const res = await fetch("/api/shoku/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      })
      if (!res.ok) {
        error = (await res.json()).error ?? "Failed to create."
      } else {
        const created = await res.json()
        categories = [...categories, created]
        formName = ""
        showForm = false
      }
    }

    saving = false
  }

  let confirmingDeleteId = $state<string | null>(null)

  async function deleteCategory(id: string) {
    const res = await fetch(`/api/shoku/categories/${id}`, { method: "DELETE" })
    if (res.ok) {
      categories = categories.filter((c) => c.id !== id)
      confirmingDeleteId = null
    }
  }

  async function moveUp(index: number) {
    if (index === 0) return
    const a = categories[index]
    const b = categories[index - 1]
    await Promise.all([
      fetch(`/api/shoku/categories/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/shoku/categories/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ])
    const newList = [...categories]
    newList[index] = { ...b, sortOrder: a.sortOrder }
    newList[index - 1] = { ...a, sortOrder: b.sortOrder }
    categories = newList
  }

  async function moveDown(index: number) {
    if (index >= categories.length - 1) return
    await moveUp(index + 1)
  }
</script>

<PageHeader title="Food Categories" subtitle="Organize your food library into categories" />

{#if categories.length === 0 && !showForm}
  <Card>
    <div class="empty">
      <p>No categories yet. Add your first category to start organizing your foods.</p>
      <Button onclick={() => { showForm = true; startCreate() }}>Add category</Button>
    </div>
  </Card>
{:else}
  <div class="category-list">
    {#each categories as cat, i}
      <Card>
        {#if editingId === cat.id}
          <div class="edit-row">
            <input
              class="name-input"
              bind:value={formName}
              placeholder="Category name"
              onkeydown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancelEdit() }}
            />
            <div class="edit-actions">
              <Button variant="primary" onclick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <button class="btn-text" onclick={cancelEdit}>Cancel</button>
            </div>
            {#if error}
              <p class="form-error">{error}</p>
            {/if}
          </div>
        {:else if confirmingDeleteId === cat.id}
          <div class="delete-confirm">
            <p>Delete "{cat.name}"? Foods using this category will become uncategorized.</p>
            <div class="delete-actions">
              <button class="btn-danger" onclick={() => deleteCategory(cat.id)}>Yes, delete</button>
              <button class="btn-text" onclick={() => (confirmingDeleteId = null)}>Cancel</button>
            </div>
          </div>
        {:else}
          <div class="category-row">
            <span class="category-name">{cat.name}</span>
            <div class="category-actions">
              <button class="btn-icon" onclick={() => moveUp(i)} disabled={i === 0} title="Move up">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button class="btn-icon" onclick={() => moveDown(i)} disabled={i === categories.length - 1} title="Move down">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <button class="btn-icon" onclick={() => startEdit(cat)} title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="btn-icon btn-icon-danger" onclick={() => (confirmingDeleteId = cat.id)} title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        {/if}
      </Card>
    {/each}
  </div>

  {#if showForm && !editingId}
    <Card>
      <div class="edit-row">
        <input
          class="name-input"
          bind:value={formName}
          placeholder="Category name"
          onkeydown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancelEdit() }}
        />
        <div class="edit-actions">
          <Button variant="primary" onclick={save} disabled={saving}>
            {saving ? "Saving..." : "Add"}
          </Button>
          <button class="btn-text" onclick={cancelEdit}>Cancel</button>
        </div>
        {#if error}
          <p class="form-error">{error}</p>
        {/if}
      </div>
    </Card>
  {/if}

  {#if !showForm && !editingId}
    <div class="add-area">
      <Button onclick={() => { showForm = true; startCreate() }}>Add category</Button>
    </div>
  {/if}
{/if}

<style>
  .empty {
    text-align: center;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    color: var(--ink-light);
  }

  .category-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .category-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .category-name {
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
  }

  .category-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .btn-icon {
    background: none;
    border: none;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--ink-light);
    border-radius: var(--radius-sm);
    transition: color var(--transition-fast), background var(--transition-fast);
  }

  .btn-icon:hover {
    color: var(--ink);
    background: var(--paper-warm);
  }

  .btn-icon:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .btn-icon:disabled:hover {
    background: none;
    color: var(--ink-light);
  }

  .btn-icon-danger:hover {
    color: var(--accent);
  }

  .edit-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .name-input {
    font-family: var(--font-body);
    font-size: var(--text-base);
    padding: var(--space-2) 0;
    border: none;
    border-bottom: 1px solid var(--border);
    background: transparent;
    color: var(--ink);
    outline: none;
    width: 100%;
    transition: border-color var(--transition-fast);
  }

  .name-input:focus {
    border-bottom-color: var(--accent);
  }

  .edit-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-text {
    background: none;
    border: none;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
  }

  .btn-text:hover {
    color: var(--ink);
  }

  .form-error {
    color: var(--accent);
    font-size: var(--text-sm);
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  .delete-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .btn-danger {
    background: var(--accent);
    color: white;
    border: none;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .add-area {
    margin-top: var(--space-4);
  }
</style>
