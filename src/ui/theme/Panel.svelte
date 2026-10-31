<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children, class: extra = "" }: { title?: string; children: Snippet; class?: string } = $props();
</script>

<section class="panel {extra}">
  {#if title}<h2>{title}</h2>{/if}
  {@render children()}
</section>

<style>
  .panel {
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    box-shadow: inset 0 0 0 2px var(--wood-dark);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
    min-width: 0;
  }
</style>
