<script lang="ts">
  import { page } from "$app/state"
  import { NavItem, ThemeToggle } from "$lib/components"
  import { icons } from "$lib/icons"
  import type { Snippet } from "svelte"

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()
  let settingsOpen = $state(false)
  let mobileNavOpen = $state(false)

  function closeMobileNav() {
    mobileNavOpen = false
    settingsOpen = false
  }

  const user = $derived(page.data.user)

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
  <!-- Mobile: floating logo button -->
  <button class="mobile-menu-btn" onclick={() => (mobileNavOpen = true)} aria-label="Open navigation">
    <span class="logo-kanji">健</span>
  </button>

  <!-- Mobile: backdrop -->
  {#if mobileNavOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sidebar-backdrop" onclick={closeMobileNav} onkeydown={closeMobileNav}></div>
  {/if}

  <aside class="sidebar" class:open={mobileNavOpen}>
    <div class="sidebar-header">
      <a href="/" class="logo" onclick={closeMobileNav}>
        <span class="logo-kanji">健</span>
        <span class="logo-text">Kenkō</span>
      </a>
    </div>


    <nav class="sidebar-nav">
      {#each navItems as item}
        <NavItem href={item.href} label={item.label} active={isActive(item.href)} onclick={closeMobileNav}>
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
      <a href="/profile" class="footer-item" class:active={page.url.pathname === "/profile"} onclick={closeMobileNav}>
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
            <a href="/shoku/library" class="settings-link" onclick={() => { settingsOpen = false; closeMobileNav() }}>
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
            <a href="/dojo/library" class="settings-link" onclick={() => { settingsOpen = false; closeMobileNav() }}>
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

  /* ---- Mobile menu button ---- */
  .mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: var(--space-3);
    left: var(--space-3);
    z-index: 20;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    border: 0.5px solid var(--border);
    background: var(--paper);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .mobile-menu-btn .logo-kanji {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--ink);
  }

  /* ---- Backdrop ---- */
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 29;
  }

  /* ---- Sidebar ---- */
  .sidebar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 240px;
    padding: var(--space-6);
    border-right: 0.5px solid var(--border);
    background: var(--paper);
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 30;
    overflow: hidden;
    transform: translateX(-100%);
    transition: transform var(--transition-base);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-header {
    margin-bottom: var(--space-6);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-height: 32px;
    width: 100%;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-1);
    flex: 1;
    width: 100%;
  }

  .sidebar-footer {
    padding-top: var(--space-4);
    border-top: 0.5px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-1);
    width: 100%;
  }

  /* ---- Footer items ---- */
  .footer-item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
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
    display: block;
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
    justify-content: flex-start;
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
    display: inline;
  }

  /* ---- Main content ---- */
  .main-content {
    flex: 1;
    margin-left: 0;
    padding: var(--space-6) var(--space-4);
    padding-top: calc(var(--space-6) + 48px);
    max-width: 100%;
    transition:
      margin-left var(--transition-base),
      max-width var(--transition-base);
  }

  /* Logout form should not add layout */
  form {
    width: 100%;
  }

  /* ---- Desktop: persistent sidebar ---- */
  @media (min-width: 768px) {
    .mobile-menu-btn {
      display: none;
    }

    .sidebar-backdrop {
      display: none;
    }

    .sidebar {
      transform: translateX(0);
    }

    .main-content {
      margin-left: 240px;
      padding: var(--space-8);
      padding-top: var(--space-8);
      max-width: calc(100% - 240px);
    }
  }
</style>
