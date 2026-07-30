export const tooltipState = $state({
  visible: false,
  x: 0,
  y: 0,
  content: "",
})

function show(node: Element, content: string, e: PointerEvent) {
  tooltipState.content = content
  tooltipState.x = e.clientX
  tooltipState.y = e.clientY
  tooltipState.visible = true
}

function move(e: PointerEvent) {
  tooltipState.x = e.clientX
  tooltipState.y = e.clientY
}

function hide() {
  tooltipState.visible = false
}

/**
 * Svelte action — attach to any element (HTML or SVG) to show the shared
 * tooltip on hover, positioned at the pointer, with no native-title delay.
 * Usage: <circle use:tooltip={"Jan 3, 2026: 182 lbs"} />
 */
export function tooltip(node: Element, content: string) {
  let current = content

  function onEnter(e: PointerEvent) {
    show(node, current, e)
  }

  node.addEventListener("pointerenter", onEnter as EventListener)
  node.addEventListener("pointermove", move as EventListener)
  node.addEventListener("pointerleave", hide)

  return {
    update(newContent: string) {
      current = newContent
    },
    destroy() {
      node.removeEventListener("pointerenter", onEnter as EventListener)
      node.removeEventListener("pointermove", move as EventListener)
      node.removeEventListener("pointerleave", hide)
    },
  }
}
