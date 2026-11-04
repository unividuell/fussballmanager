<script lang="ts">
  import { generateWorld } from "../../engine/generator";
  import { LEAGUE_SIZE, type ClubId, type GameState } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { clubRating } from "../logic/tables";
  import Crest from "../theme/Crest.svelte";
  import Dialog from "../theme/Dialog.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();

  const initialSeed = Math.floor(Math.random() * 1_000_000);
  let seedText = $state(String(initialSeed));
  let world: GameState = $state.raw(generateWorld(initialSeed));
  let count = $state(1);
  let names = $state(["Manager 1", "Manager 2", "Manager 3", "Manager 4"]);
  let picks = $state<(ClubId | "")[]>(["", "", "", ""]);
  let error = $state<string | null>(null);
  let confirmOverwrite = $state(false);
  const canContinue = $derived(controller.slots.some((s) => s.slot === "auto" && s.meta !== null));

  const ranked = $derived(Object.values(world.clubs).sort((a, b) => b.reputation - a.reputation || (a.id < b.id ? -1 : 1)));
  const first = $derived(ranked.slice(0, LEAGUE_SIZE));
  const second = $derived(ranked.slice(LEAGUE_SIZE));

  function newWorld(): void {
    const seed = Number.parseInt(seedText, 10);
    world = generateWorld(Number.isFinite(seed) ? seed : 0);
    picks = ["", "", "", ""];
    error = null;
  }

  function start(): void {
    const chosen = picks.slice(0, count);
    if (chosen.some((p) => p === "")) {
      error = "Bitte wähle für jeden Manager einen Verein.";
      return;
    }
    if (canContinue && !confirmOverwrite) {
      confirmOverwrite = true;
      return;
    }
    confirmOverwrite = false;
    error = controller.startGame(
      world,
      chosen.map((clubId, i) => ({ name: names[i], clubId: clubId as ClubId })),
    );
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape" && confirmOverwrite) {
      e.preventDefault();
      confirmOverwrite = false;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="newgame">
  <div class="start">
    {#if canContinue}<button class="btn primary" onclick={() => void controller.loadFrom("auto")}>Weiterspielen</button>{/if}
    <button class="btn" onclick={() => controller.openStart("loadGame")}>Spiel laden</button>
    <button class="btn" onclick={() => controller.openStart("startOptions")}>Optionen</button>
  </div>

  <Panel>
    <div class="head">
      <h1>NEUES SPIEL</h1>
      <label class="seed">Seed <input aria-label="Seed" bind:value={seedText} inputmode="numeric" size="8" /></label>
      <button class="btn" onclick={newWorld}>Neue Welt</button>
    </div>
  </Panel>

  <Panel title="MANAGER">
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
      <div class="row">
        <span class="no">{i + 1}</span>
        <input aria-label="Name Manager {i + 1}" bind:value={names[i]} maxlength="16" />
        <select aria-label="Verein Manager {i + 1}" bind:value={picks[i]}>
          <option value="">– Verein wählen –</option>
          <optgroup label="1. Liga">
            {#each first as club (club.id)}<option value={club.id}>{club.name} ({clubRating(world, club.id)})</option>{/each}
          </optgroup>
          <optgroup label="2. Liga">
            {#each second as club (club.id)}<option value={club.id}>{club.name} ({clubRating(world, club.id)})</option>{/each}
          </optgroup>
        </select>
        {#if picks[i]}
          {@const club = world.clubs[picks[i]]}
          <Crest colors={club.colors} pattern={club.crest} size={32} />
        {/if}
      </div>
    {/each}
  </Panel>

  <div class="foot">
    <span>Manager:</span>
    {#each [1, 2, 3, 4] as n (n)}
      <button class="btn" class:selected={count === n} onclick={() => (count = n)}>{n}</button>
    {/each}
    <span class="spacer"></span>
    {#if error ?? controller.message}<span class="msg">{error ?? controller.message}</span>{/if}
    <button class="btn primary" onclick={start}>Anpfiff!</button>
  </div>
</div>

{#if confirmOverwrite}
  <Dialog title="BESTÄTIGEN" onClose={() => (confirmOverwrite = false)}>
    <p>Neues Spiel starten? Der Autosave des bisherigen Spiels wird überschrieben.</p>
    <div class="row">
      <button class="btn primary" onclick={start}>Ja</button>
      <button class="btn" onclick={() => (confirmOverwrite = false)}>Nein</button>
    </div>
  </Dialog>
{/if}

<style>
  .newgame {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    height: 100%;
    box-sizing: border-box;
  }
  .start { display: flex; gap: 12px; justify-content: flex-end; }
  .head { display: flex; align-items: center; gap: 24px; }
  .seed { margin-left: auto; color: var(--leaf); }
  .row { display: flex; align-items: center; gap: 16px; }
  .no { font-family: var(--font-display); font-size: 16px; color: var(--gold); width: 24px; }
  input,
  select {
    font-family: var(--font-body);
    font-size: 24px;
    color: var(--cream);
    background: var(--wood-dark);
    border: 4px solid var(--wood-edge);
    padding: 2px 8px;
  }
  select { flex: 1; min-width: 0; }
  .foot { display: flex; align-items: center; gap: 12px; margin-top: auto; }
  .spacer { flex: 1; }
  .row { display: flex; gap: 16px; justify-content: flex-end; }
  p { margin: 0 0 16px; }
</style>
