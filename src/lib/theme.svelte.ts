import { browser } from "$app/environment"

type Theme = "light" | "dark"

function createTheme() {
  let current = $state<Theme>("light")

  if (browser) {
    const stored = localStorage.getItem("kenko-theme") as Theme | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    current = stored ?? (prefersDark ? "dark" : "light")
  }

  return {
    get current() {
      return current
    },
    toggle() {
      current = current === "light" ? "dark" : "light"
      if (browser) {
        document.documentElement.setAttribute("data-theme", current)
        localStorage.setItem("kenko-theme", current)
      }
    },
  }
}

export const theme = createTheme()
