<script lang="ts">
  import { tooltip } from "$lib/tooltip.svelte"

  let { medal, title = "" }: { medal: "gold" | "silver" | "bronze"; title?: string } = $props()

  const LABELS = { gold: "Gold week", silver: "Silver week", bronze: "Bronze week" }
</script>

<span class="medal medal-{medal}" use:tooltip={title} aria-label={LABELS[medal]} role="img">
  <svg viewBox="0 0 24 30">
    <!-- Ribbon tails -->
    <path d="M7 1h4l2.5 9h-4z" class="ribbon ribbon-left" />
    <path d="M17 1h-4l-2.5 9h4z" class="ribbon ribbon-right" />
    <!-- Die-cut edge + disc -->
    <circle cx="12" cy="19" r="9" class="edge" />
    <circle cx="12" cy="19" r="9" class="disc" />
    <circle cx="12" cy="19" r="6.4" class="inner" />
    <path d="M12 15.2l1.2 2.45 2.7.4-1.95 1.9.46 2.68L12 21.36l-2.41 1.27.46-2.68-1.95-1.9 2.7-.4z" class="star" />
  </svg>
</span>

<style>
  .medal {
    display: inline-flex;
    transform: rotate(6deg);
    filter: drop-shadow(0 1px 1.5px var(--sticker-shadow));
    line-height: 0;
  }

  .medal svg {
    width: 24px;
    height: 30px;
    overflow: visible;
  }

  .ribbon-left {
    fill: var(--accent-green);
  }

  .ribbon-right {
    fill: var(--accent-red);
  }

  .edge {
    fill: var(--sticker-edge);
    stroke: var(--sticker-edge);
    stroke-width: 3;
  }

  .inner {
    fill: none;
    stroke-width: 0.8;
    opacity: 0.7;
  }

  .star {
    fill: var(--sticker-edge);
    opacity: 0.9;
  }

  .medal-gold .disc { fill: var(--award-gold); }
  .medal-gold .inner { stroke: var(--award-gold-deep); }
  .medal-silver .disc { fill: var(--award-silver); }
  .medal-silver .inner { stroke: var(--award-silver-deep); }
  .medal-bronze .disc { fill: var(--award-bronze); }
  .medal-bronze .inner { stroke: var(--award-bronze-deep); }
</style>
