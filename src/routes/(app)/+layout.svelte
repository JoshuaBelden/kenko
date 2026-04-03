<script lang="ts">
  import { page } from "$app/state"
  import { NavItem, ThemeToggle } from "$lib/components"
  import { icons } from "$lib/icons"
  import { journeyLens } from "$lib/stores/journeyLens.svelte"
  import type { Snippet } from "svelte"

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()
  let settingsOpen = $state(false)
  let lensOpen = $state(false)

  const user = $derived(page.data.user)
  const activeJourneys = $derived(page.data.activeJourneys ?? [])

  // Clear stale lens selection if the journey no longer exists
  $effect(() => {
    if (journeyLens.selectedId && activeJourneys.length > 0) {
      const exists = activeJourneys.some(j => j.id === journeyLens.selectedId)
      if (!exists) journeyLens.clear()
    }
  })

  const selectedJourneyName = $derived(
    journeyLens.isGlobalView
      ? "All data"
      : (activeJourneys.find(j => j.id === journeyLens.selectedId)?.name ?? "All data"),
  )

  const navItems = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/tabi", label: "Tabi", icon: "tabi" },
    { href: "/shoku", label: "Shoku", icon: "shoku" },
    { href: "/danjiki", label: "Danjiki", icon: "danjiki" },
    { href: "/dojo", label: "Dojo", icon: "dojo" },
    { href: "/kata", label: "Kata", icon: "kata" },
  ]

  function isActive(href: string): boolean {
    if (href === "/") return page.url.pathname === "/"
    return page.url.pathname.startsWith(href)
  }

  function icon(name: string): string {
    return icons[name] ?? ""
  }
</script>

<div class="app-layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <a href="/" class="logo">
        <span class="logo-kanji">健</span>
        <span class="logo-text">Kenkō</span>
      </a>
    </div>

    {#if activeJourneys.length > 0}
      <div class="sidebar-lens">
        <button class="lens-toggle" onclick={() => (lensOpen = !lensOpen)}>
          <span class="lens-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </span>
          <span class="lens-label">{selectedJourneyName}</span>
        </button>

        {#if lensOpen}
          <div class="lens-popover">
            <button
              class="lens-option"
              class:active={journeyLens.isGlobalView}
              onclick={() => {
                journeyLens.clear()
                lensOpen = false
              }}
            >
              All data
            </button>
            {#each activeJourneys as journey}
              <button
                class="lens-option"
                class:active={journeyLens.selectedId === journey.id}
                onclick={() => {
                  journeyLens.select(journey.id)
                  lensOpen = false
                }}
              >
                {journey.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <nav class="sidebar-nav">
      {#each navItems as item}
        <NavItem href={item.href} label={item.label} active={isActive(item.href)}>
          {#snippet children()}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              {@html icon(item.icon)}
            </svg>
          {/snippet}
        </NavItem>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <!-- Profile link -->
      <a href="/profile" class="footer-item" class:active={page.url.pathname === "/profile"}>
        <span class="footer-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span class="footer-label">{user?.email ?? ""}</span>
      </a>

      <!-- Settings -->
      <div class="settings-wrapper">
        <button class="footer-item" onclick={() => (settingsOpen = !settingsOpen)}>
          <span class="footer-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </span>
          <span class="footer-label">Settings</span>
        </button>

        {#if settingsOpen}
          <div class="settings-popover">
            <div class="settings-row">
              <span class="settings-label">Theme</span>
              <ThemeToggle />
            </div>
            <a href="/shoku/library" class="settings-link" onclick={() => (settingsOpen = false)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              </svg>
              <span>Food Library</span>
            </a>
            <a href="/dojo/library" class="settings-link" onclick={() => (settingsOpen = false)}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M6.5 6.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0" /><line x1="10" y1="10" x2="10" y2="21" /><line x1="4" y1="15" x2="16" y2="15" />
              </svg>
              <span>Exercise Library</span>
            </a>
          </div>
        {/if}
      </div>

      <!-- Logout -->
      <form method="POST" action="/logout">
        <button type="submit" class="footer-item">
          <span class="footer-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          <span class="footer-label">Sign out</span>
        </button>
      </form>
    </div>
  </aside>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100dvh;
  }

  /* ---- Sidebar ---- */
  .sidebar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 48px;
    padding: var(--space-3) var(--space-2);
    border-right: 0.5px solid var(--border);
    background: var(--paper);
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 10;
    overflow: hidden;
    transition: width var(--transition-base);
  }

  .sidebar-header {
    margin-bottom: var(--space-6);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    width: 100%;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    flex: 1;
    width: 100%;
  }

  .sidebar-footer {
    padding-top: var(--space-4);
    border-top: 0.5px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
  }

  /* ---- Lens toggle ---- */
  .sidebar-lens {
    position: relative;
    padding: var(--space-3) 0;
    border-bottom: 0.5px solid var(--border);
    width: 100%;
  }

  .lens-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ink-light);
    font-family: var(--font-body);
    font-size: var(--text-xs);
    width: 100%;
    transition: all var(--transition-fast);
  }

  .lens-toggle:hover {
    color: var(--ink);
    background: var(--paper-warm);
  }

  .lens-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .lens-label {
    display: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    flex: 1;
    font-weight: 500;
  }

  .lens-popover {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: var(--space-2);
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    min-width: 160px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    z-index: 20;
  }

  .lens-option {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-align: left;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .lens-option:hover {
    color: var(--ink);
    background: var(--paper-warm);
  }

  .lens-option.active {
    color: var(--accent);
    font-weight: 500;
  }

  /* ---- Footer items ---- */
  .footer-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: var(--ink-light);
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
    width: 100%;
  }

  .footer-item:hover {
    color: var(--ink);
    background: var(--paper-warm);
  }

  .footer-item.active {
    color: var(--accent);
  }

  .footer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .footer-label {
    display: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    flex: 1;
  }

  /* ---- Settings popover ---- */
  .settings-wrapper {
    position: relative;
    width: 100%;
  }

  .settings-popover {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: var(--space-2);
    background: var(--paper-card);
    border: 0.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    min-width: 160px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .settings-link {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 0.5px solid var(--border);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .settings-link:hover {
    color: var(--ink);
  }

  .settings-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--ink-light);
  }

  /* ---- Logo ---- */
  .logo {
    text-decoration: none;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: var(--space-2);
    white-space: nowrap;
  }

  .logo-kanji {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--ink);
    flex-shrink: 0;
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 400;
    color: var(--ink-light);
    display: none;
  }

  /* ---- Main content ---- */
  .main-content {
    flex: 1;
    margin-left: 48px;
    padding: var(--space-6) var(--space-4);
    max-width: calc(100% - 48px);
    transition:
      margin-left var(--transition-base),
      max-width var(--transition-base);
  }

  /* Logout form should not add layout */
  form {
    width: 100%;
  }

  /* ---- Desktop: expanded sidebar ---- */
  @media (min-width: 768px) {
    .sidebar {
      width: 240px;
      padding: var(--space-6);
      align-items: stretch;
    }

    .sidebar-header {
      justify-content: flex-start;
    }

    .sidebar-nav {
      align-items: stretch;
    }

    .sidebar-footer {
      align-items: stretch;
    }

    .footer-item {
      justify-content: flex-start;
    }

    .footer-label {
      display: block;
    }

    .lens-label {
      display: block;
    }

    .lens-toggle {
      justify-content: flex-start;
    }

    .logo {
      justify-content: flex-start;
    }

    .logo-text {
      display: inline;
    }

    .main-content {
      margin-left: 240px;
      padding: var(--space-8);
      max-width: calc(100% - 240px);
    }
  }
</style>
