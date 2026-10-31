<script lang="ts">
  import type { GameController } from "./ui/controller.svelte";
  import Conference from "./ui/screens/Conference.svelte";
  import Halftime from "./ui/screens/Halftime.svelte";
  import MainMenu from "./ui/screens/MainMenu.svelte";
  import NewGame from "./ui/screens/NewGame.svelte";
  import Results from "./ui/screens/Results.svelte";
  import SeasonEnd from "./ui/screens/SeasonEnd.svelte";
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
    <Tables {controller} managerId={controller.snapshot!.state.managers[0]?.id ?? null} onBack={() => controller.setResultsTables(false)} />
  {:else if view.kind === "conference"}
    {#key view.half}<Conference {controller} half={view.half} />{/key}
  {:else if view.kind === "halftime"}
    {#key view.managerId}<Halftime {controller} managerId={view.managerId} />{/key}
  {:else if view.kind === "results"}
    <Results {controller} />
  {:else if view.kind === "seasonEnd"}
    <SeasonEnd {controller} />
  {/if}
</Screen>
