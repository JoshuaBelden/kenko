import { browser } from "$app/environment"

const STORAGE_KEY = "kenko-journey-lens"

function createJourneyLens() {
  let selectedId = $state<string | null>(null)

  if (browser) {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      selectedId = stored
    }
  }

  return {
    get selectedId() {
      return selectedId
    },
    get isGlobalView() {
      return selectedId === null
    },
    select(journeyId: string) {
      selectedId = journeyId
      if (browser) localStorage.setItem(STORAGE_KEY, journeyId)
    },
    clear() {
      selectedId = null
      if (browser) localStorage.removeItem(STORAGE_KEY)
    },
  }
}

export const journeyLens = createJourneyLens()
