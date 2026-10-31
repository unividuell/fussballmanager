<script lang="ts">
  import type { GameController } from "./ui/controller.svelte";
  import NewGame from "./ui/screens/NewGame.svelte";
  import Screen from "./ui/theme/Screen.svelte";

  let { controller }: { controller: GameController } = $props();
  const view = $derived(controller.view);
</script>

<Screen>
  {#if view.kind === "newGame"}
    <NewGame {controller} />
  {:else}
    <p class="placeholder">Bildschirm „{view.kind}“ folgt.</p>
  {/if}
</Screen>

<style>
  .placeholder { padding: 16px; }
</style>
