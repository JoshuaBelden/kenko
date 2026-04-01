import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async () => {
  // TODO: Load user session from cookie
  return {
    user: null,
  }
}
