<script lang="ts">
  import { tooltip } from "$lib/tooltip.svelte"

  let { tier, title = "" }: { tier: "perfect" | "outstanding"; title?: string } = $props()

  // Scalloped 12-point burst for the Perfect sticker
  function burstPath(points: number, outer: number, inner: number, c = 12): string {
    const pts: string[] = []
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = (Math.PI * i) / points - Math.PI / 2
      pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`)
    }
    return `M${pts.join("L")}Z`
  }

  const STAR = "M12 6.2l1.75 3.6 3.95.55-2.87 2.77.7 3.93L12 15.18l-3.53 1.87.7-3.93-2.87-2.77 3.95-.55z"
  const BURST = burstPath(12, 11, 9.4)
</script>

<span class="sticker sticker-{tier}" use:tooltip={title} aria-label={tier === "perfect" ? "Perfect day" : "Outstanding day"} role="img">
  <svg viewBox="0 0 24 24">
    {#if tier === "perfect"}
      <path d={BURST} class="edge" />
      <path d={BURST} class="face" />
      <circle cx="12" cy="12" r="7.2" class="ring" />
      <path d={STAR} class="star" />
    {:else}
      <circle cx="12" cy="12" r="9.5" class="edge" />
      <circle cx="12" cy="12" r="9.5" class="face" />
      <path d={STAR} class="star" />
    {/if}
  </svg>
</span>

<style>
  .sticker {
    display: inline-flex;
    transform: rotate(-8deg);
    filter: drop-shadow(0 1px 1.5px var(--sticker-shadow));
    line-height: 0;
  }

  .sticker svg {
    overflow: visible;
  }

  .sticker-perfect svg {
    width: 26px;
    height: 26px;
  }

  .sticker-outstanding svg {
    width: 20px;
    height: 20px;
  }

  /* Die-cut white border drawn as a fat stroke behind the face */
  .edge {
    fill: var(--sticker-edge);
    stroke: var(--sticker-edge);
    stroke-width: 3;
    stroke-linejoin: round;
  }

  .sticker-perfect .face {
    fill: var(--award-gold);
  }

  .sticker-perfect .ring {
    fill: none;
    stroke: var(--award-gold-deep);
    stroke-width: 0.8;
    opacity: 0.6;
  }

  .sticker-outstanding .face {
    fill: var(--accent-green);
  }

  .star {
    fill: var(--sticker-edge);
  }

  .sticker-perfect .star {
    fill: #fff8e1;
    stroke: var(--award-gold-deep);
    stroke-width: 0.5;
  }
</style>
