<script lang="ts">
  import type { Snippet } from "svelte";
  import Panel from "./Panel.svelte";

  let { title, children, onClose }: { title: string; children: Snippet; onClose: () => void } = $props();
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={title}>
  <Panel {title} class="dialog">
    {@render children()}
    <button class="btn close" onclick={onClose}>Schließen (Esc)</button>
  </Panel>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    background: var(--shade);
  }
  .overlay :global(.dialog) {
    width: 880px;
    max-height: 740px;
    overflow-y: auto;
  }
  .close { align-self: flex-end; }
</style>
