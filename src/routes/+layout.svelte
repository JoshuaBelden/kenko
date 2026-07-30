<script lang="ts">
  import type { Snippet } from "svelte"
  import "../app.css"
  import { Tooltip } from "$lib/components"

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()
</script>

{@render children()}
<Tooltip />
