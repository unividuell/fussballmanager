<script lang="ts">
  import { generateWorld } from "../../engine/generator";
  import { LEAGUE_SIZE, type ClubId, type GameState } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { clubRating } from "../logic/tables";
  import Crest from "../theme/Crest.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();

  const initialSeed = Math.floor(Math.random() * 1_000_000);
  let seedText = $state(String(initialSeed));
  let world: GameState = $state.raw(generateWorld(initialSeed));
  let count = $state(1);
  let names = $state(["Manager 1", "Manager 2", "Manager 3", "Manager 4"]);
  let picks = $state<(ClubId | "")[]>(["", "", "", ""]);
  let error = $state<string | null>(null);

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
    error = controller.startGame(
      world,
      chosen.map((clubId, i) => ({ name: names[i], clubId: clubId as ClubId })),
    );
  }
</script>

<div class="newgame">
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
          <Crest colors={club.colors} pattern={club.crest} size={16} />
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
    {#if error}<span class="msg">{error}</span>{/if}
    <button class="btn primary" onclick={start}>Anpfiff!</button>
  </div>
</div>

<style>
  .newgame {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    height: 100%;
    box-sizing: border-box;
  }
  .head { display: flex; align-items: center; gap: 12px; }
  .seed { margin-left: auto; color: var(--leaf); }
  .row { display: flex; align-items: center; gap: 8px; }
  .no { font-family: var(--font-display); font-size: 8px; color: var(--gold); width: 12px; }
  input,
  select {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--cream);
    background: var(--wood-dark);
    border: 2px solid var(--wood-edge);
    padding: 1px 4px;
  }
  select { flex: 1; min-width: 0; }
  .foot { display: flex; align-items: center; gap: 6px; margin-top: auto; }
  .spacer { flex: 1; }
</style>
