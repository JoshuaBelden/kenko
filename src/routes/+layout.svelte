<script lang="ts">
  import { page } from "$app/state"
  import { NavItem, ThemeToggle } from "$lib/components"
  import type { Snippet } from "svelte"
  import "../app.css"

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()

  const navItems = [
    { href: "/", label: "Dashboard", kanji: undefined, icon: "dashboard" },
    { href: "/tabi", label: "Tabi", kanji: "旅", icon: "tabi" },
    { href: "/shoku", label: "Shoku", kanji: "食", icon: "shoku" },
    { href: "/dojo", label: "Dojo", kanji: "道場", icon: "dojo" },
    { href: "/kata", label: "Kata", kanji: "型", icon: "kata" },
  ]

  function isActive(href: string): boolean {
    if (href === "/") return page.url.pathname === "/"
    return page.url.pathname.startsWith(href)
  }

  function icon(name: string): string {
    const icons: Record<string, string> = {
      tabi: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
      dashboard:
        '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
      shoku:
        '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
      dojo: '<path d="M6.5 6.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0"/><line x1="10" y1="10" x2="10" y2="21"/><line x1="4" y1="15" x2="16" y2="15"/>',
      kata: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    }
    return icons[name] ?? ""
  }
</script>

<div class="app-layout">
  <!-- Sidebar (all sizes — collapsed on small, expanded on desktop) -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <a href="/" class="logo">
        <span class="logo-kanji">健</span>
        <span class="logo-text">Kenko</span>
      </a>
    </div>

    <nav class="sidebar-nav">
      {#each navItems as item}
        <NavItem href={item.href} label={item.label} kanji={item.kanji} active={isActive(item.href)}>
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
      <ThemeToggle />
    </div>
  </aside>

  <!-- Main content -->
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
    justify-content: center;
    width: 100%;
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
