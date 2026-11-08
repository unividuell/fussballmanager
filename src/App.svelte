<script lang="ts">
  import type { GameController } from "./ui/controller.svelte";
  import LiveScreen from "./ui/screens/LiveScreen.svelte";
  import Contracts from "./ui/screens/Contracts.svelte";
  import FailureDialog from "./ui/screens/FailureDialog.svelte";
  import Finance from "./ui/screens/Finance.svelte";
  import Halftime from "./ui/screens/Halftime.svelte";
  import MainMenu from "./ui/screens/MainMenu.svelte";
  import Messages from "./ui/screens/Messages.svelte";
  import Options from "./ui/screens/Options.svelte";
  import NewGame from "./ui/screens/NewGame.svelte";
  import SaveLoad from "./ui/screens/SaveLoad.svelte";
  import Results from "./ui/screens/Results.svelte";
  import SeasonEnd from "./ui/screens/SeasonEnd.svelte";
  import Squad from "./ui/screens/Squad.svelte";
  import Tables from "./ui/screens/Tables.svelte";
  import Transfers from "./ui/screens/Transfers.svelte";
  import Training from "./ui/screens/Training.svelte";
  import TurnStart from "./ui/screens/TurnStart.svelte";
  import Screen from "./ui/theme/Screen.svelte";

  let { controller }: { controller: GameController } = $props();
  const view = $derived(controller.view);
</script>

<Screen scanlines={controller.options.scanlines}>
  {#if view.kind === "newGame"}
    <NewGame {controller} />
  {:else if view.kind === "startOptions"}
    <Options {controller} onBack={() => controller.openStart("newGame")} />
  {:else if view.kind === "options"}
    <Options {controller} onBack={() => controller.open("menu")} />
  {:else if view.kind === "loadGame"}
    <SaveLoad {controller} managerId={null} onBack={() => controller.openStart("newGame")} />
  {:else if view.kind === "save"}
    <SaveLoad {controller} managerId={view.managerId} onBack={() => controller.open("menu")} />
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
  {:else if view.kind === "live"}
    {#key view.half}<LiveScreen {controller} half={view.half} />{/key}
  {:else if view.kind === "halftime"}
    {#key view.managerId}<Halftime {controller} managerId={view.managerId} />{/key}
  {:else if view.kind === "results"}
    <Results {controller} />
  {:else if view.kind === "seasonEnd"}
    <SeasonEnd {controller} />
  {:else if view.kind === "training"}
    <Training {controller} managerId={view.managerId} />
  {:else if view.kind === "finance"}
    <Finance {controller} managerId={view.managerId} />
  {:else if view.kind === "contracts"}
    <Contracts {controller} managerId={view.managerId} />
  {:else if view.kind === "transfers"}
    <Transfers {controller} managerId={view.managerId} />
  {:else if view.kind === "messages"}
    <Messages {controller} managerId={view.managerId} />
  {/if}
  {#if controller.failure}<FailureDialog {controller} />{/if}
</Screen>

