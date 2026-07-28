<script lang="ts">
  import type { Snippet } from "svelte"

  interface Props {
    percent: number
    size?: number
    strokeWidth?: number
    over?: boolean
    children?: Snippet
  }

  let { percent, size = 88, strokeWidth = 8, over = false, children }: Props = $props()

  const clamped = $derived(Math.min(100, Math.max(0, percent)))
  const radius = $derived((size - strokeWidth) / 2)
  const circumference = $derived(2 * Math.PI * radius)
  const offset = $derived(circumference - (clamped / 100) * circumference)
  const center = $derived(size / 2)
</script>

<div class="radial" class:over style:width="{size}px" style:height="{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}">
    <circle class="radial-track" cx={center} cy={center} r={radius} stroke-width={strokeWidth} fill="none" />
    <circle
      class="radial-fill"
      cx={center}
      cy={center}
      r={radius}
      stroke-width={strokeWidth}
      fill="none"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      transform="rotate(-90 {center} {center})"
    />
  </svg>
  {#if children}
    <div class="radial-content">{@render children()}</div>
  {/if}
</div>

<style>
  .radial {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .radial-track {
    stroke: var(--paper-warm);
  }

  .radial-fill {
    stroke: var(--accent-green);
    stroke-linecap: round;
    transition: stroke-dashoffset var(--transition-fast), stroke var(--transition-fast);
  }

  .radial.over .radial-fill {
    stroke: var(--accent-red);
  }

  .radial-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
</style>
