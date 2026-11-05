<script lang="ts">
  import type { GameController } from "../controller.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();
  const canLoadAuto = $derived(controller.hasStore && controller.slots.some((s) => s.slot === "auto" && s.meta !== null));
</script>

<!-- Ohne Tasten und ohne „Schließen“: siehe Plan 4, Task 4. -->
<div class="overlay" role="dialog" aria-modal="true" aria-label="FEHLER">
  <Panel title="FEHLER">
    <p>Beim Berechnen ist ein Fehler aufgetreten. Der Spielstand vor diesem Schritt ist erhalten.</p>
    {#if controller.message}<p class="msg">{controller.message}</p>{/if}
    <div class="row">
      <button class="btn primary" onclick={() => controller.retryFailure()}>Spieltag erneut versuchen</button>
      {#if canLoadAuto}<button class="btn" onclick={() => void controller.loadAutosaveAfterFailure()}>Autosave laden</button>{/if}
    </div>
  </Panel>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    background: var(--shade);
  }
  p { margin: 0 0 16px; max-width: 800px; font-size: 26px; }
  .row { display: flex; gap: 16px; justify-content: flex-end; }
</style>
