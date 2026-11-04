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
    border: 6px solid var(--wood-edge);
    box-shadow: inset 0 0 0 4px var(--wood-dark);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    min-width: 0;
  }
</style>
