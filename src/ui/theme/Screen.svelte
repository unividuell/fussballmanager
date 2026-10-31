<script lang="ts">
  import type { Snippet } from "svelte";
  import { BASE_H, BASE_W, fitScale } from "../logic/scale";

  let { children, scanlines = false }: { children: Snippet; scanlines?: boolean } = $props();
  let viewW = $state(BASE_W);
  let viewH = $state(BASE_H);
  const scale = $derived(fitScale(viewW, viewH));
</script>

<svelte:window bind:innerWidth={viewW} bind:innerHeight={viewH} />

<div class="stage">
  <div
    class="screen"
    class:scanlines
    style:width="{BASE_W}px"
    style:height="{BASE_H}px"
    style:transform="scale({scale})"
  >
    {@render children()}
  </div>
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--ink);
  }
  .screen {
    position: relative;
    overflow: hidden;
    flex: none;
    transform-origin: center;
    image-rendering: pixelated;
    background: repeating-linear-gradient(90deg, var(--grass-1) 0 40px, var(--grass-2) 40px 80px);
  }
  .screen.scanlines::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.22) 0 1px, transparent 1px 3px);
  }
</style>
