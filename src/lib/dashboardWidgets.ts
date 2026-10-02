/** Journey dashboard widgets, in their default order. */
export const DEFAULT_WIDGET_ORDER = ["shoku", "weight", "kata", "dojo", "running", "danjiki"] as const

export type DashboardWidgetId = (typeof DEFAULT_WIDGET_ORDER)[number]

export interface DashboardLayout {
  order: DashboardWidgetId[]
  collapsed: DashboardWidgetId[]
}

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && (DEFAULT_WIDGET_ORDER as readonly string[]).includes(value)
}

/** Saved order first, then any widgets missing from it (e.g. newly added ones) in default order. */
export function resolveWidgetOrder(saved: readonly string[] | null | undefined): DashboardWidgetId[] {
  const order = (saved ?? []).filter(isDashboardWidgetId)
  return [...new Set([...order, ...DEFAULT_WIDGET_ORDER])]
}
