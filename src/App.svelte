<script lang="ts">
  import type { GameController } from "./ui/controller.svelte";
  import MainMenu from "./ui/screens/MainMenu.svelte";
  import NewGame from "./ui/screens/NewGame.svelte";
  import Squad from "./ui/screens/Squad.svelte";
  import Tables from "./ui/screens/Tables.svelte";
  import TurnStart from "./ui/screens/TurnStart.svelte";
  import Screen from "./ui/theme/Screen.svelte";

  let { controller }: { controller: GameController } = $props();
  const view = $derived(controller.view);
</script>

<Screen>
  {#if view.kind === "newGame"}
    <NewGame {controller} />
  {:else if view.kind === "turnStart"}
    {#key view.managerId}<TurnStart {controller} managerId={view.managerId} />{/key}
  {:else if view.kind === "menu"}
    <MainMenu {controller} managerId={view.managerId} />
  {:else if view.kind === "squad"}
    <Squad {controller} managerId={view.managerId} />
  {:else if view.kind === "tables"}
    <Tables {controller} managerId={view.managerId} onBack={() => controller.open("menu")} />
  {:else if view.kind === "resultsTables"}
    <Tables {controller} managerId={null} onBack={() => controller.setResultsTables(false)} />
  {:else}
    <p class="placeholder">Bildschirm „{view.kind}“ folgt.</p>
  {/if}
</Screen>

<style>
  .placeholder { padding: 16px; }
</style>
