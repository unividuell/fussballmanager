<script lang="ts">
  import { findLiveFor } from "../../engine/commands";
  import { FORMATION_LIST, type ManagerId, type PlayerId, type Style, type Tactics } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { POSITION_LABEL, STYLE_LABEL, fitnessText, playerName } from "../logic/format";
  import { addSub, currentBench, currentPitch, emptyDraft, remainingSubs, removeSub, toCommand, type HalftimeDraft } from "../logic/halftimeDraft";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const STYLES: Style[] = ["defensive", "normal", "offensive"];
  const gs = $derived(controller.snapshot!.state);
  const lives = $derived(controller.snapshot!.lives);
  const loc = $derived(findLiveFor(gs, lives, managerId));
  const live = $derived(loc ? lives[loc.index] : null);
  const side = $derived(live && loc ? live[loc.side] : null);

  let draft = $state<HalftimeDraft>(emptyDraft());
  let pickedOut = $state<PlayerId | null>(null);
  let note = $state<string | null>(null);
  let busy = false;

  const pitch = $derived(side ? currentPitch(side, draft) : []);
  const bench = $derived(side ? currentBench(side, draft) : []);
  const tactics = $derived<Tactics | null>(side ? { ...side.tactics, ...draft.tactics } : null);
  const name = (id: PlayerId) => playerName(gs.players[id]);

  function pickPitch(id: PlayerId): void {
    pickedOut = pickedOut === id ? null : id;
    note = null;
  }

  function pickBench(id: PlayerId): void {
    if (!side) return;
    if (!pickedOut) {
      note = "Erst einen Spieler auf dem Platz wählen.";
      return;
    }
    const r = addSub(side, draft, pickedOut, id);
    pickedOut = null;
    if (typeof r === "string") note = r;
    else {
      draft = r;
      note = null;
    }
  }

  function setTactics(patch: Partial<Tactics>): void {
    draft = { ...draft, tactics: { ...draft.tactics, ...patch } };
  }

  async function done(): Promise<void> {
    if (busy) return;
    busy = true;
    const cmd = toCommand(managerId, draft);
    if (cmd && !(await controller.send(cmd))) {
      busy = false;
      return;
    }
    await controller.endTurn(managerId);
    busy = false;
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void done();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="halftime">
  <div class="bar">
    <span>HALBZEIT · {controller.managerName(managerId)}</span>
    {#if live}
      <span>{gs.clubs[live.home.club].shortName} {live.home.goals}:{live.away.goals} {gs.clubs[live.away.club].shortName}</span>
    {/if}
  </div>
  {#if side && tactics}
    <div class="body">
      <Panel title="AUF DEM PLATZ">
        <ul>
          {#each pitch as pp (pp.id)}
            <li class:picked={pickedOut === pp.id}>
              <span class="slot">{POSITION_LABEL[pp.slot]}</span>
              <button class="name" aria-label="{name(pp.id)} {pp.id}" onclick={() => pickPitch(pp.id)}>{name(pp.id)}</button>
              <span class="fit">{fitnessText(side.fitness[pp.id] ?? gs.players[pp.id].fitness)}</span>
              <span class="card">{side.booked.includes(pp.id) ? "G" : ""}</span>
            </li>
          {/each}
        </ul>
      </Panel>
      <Panel title="BANK">
        <ul>
          {#each bench as id (id)}
            <li>
              <span class="slot">{POSITION_LABEL[gs.players[id].position]}</span>
              <button class="name" aria-label="{name(id)} {id}" onclick={() => pickBench(id)}>{name(id)}</button>
            </li>
          {/each}
        </ul>
      </Panel>
      <div class="side">
        <Panel title="WECHSEL">
          <span>Wechsel übrig: {remainingSubs(side, draft)}</span>
          {#each draft.subs as s, i (s.out + s.in)}
            <div class="sub">
              <span>{name(s.in)} für {name(s.out)}</span>
              <button class="btn x" aria-label="Wechsel entfernen" onclick={() => (draft = removeSub(draft, i))}>✕</button>
            </div>
          {/each}
        </Panel>
        <Panel title="TAKTIK">
          <div class="opts">
            {#each FORMATION_LIST as f (f)}
              <button class="btn" class:selected={tactics.formation === f} onclick={() => setTactics({ formation: f })}>{f}</button>
            {/each}
          </div>
          <div class="opts">
            {#each STYLES as st (st)}
              <button class="btn" class:selected={tactics.style === st} onclick={() => setTactics({ style: st })}>{STYLE_LABEL[st]}</button>
            {/each}
          </div>
        </Panel>
      </div>
    </div>
  {:else}
    <p class="none">Dein Verein spielt heute nicht.</p>
  {/if}
  <div class="foot">
    {#if note}<span class="msg">{note}</span>{/if}
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn primary" onclick={() => void done()}>Fertig (Enter)</button>
  </div>
</div>

<style>
  .halftime { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  .bar {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-display);
    font-size: 8px;
    color: var(--gold);
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    padding: 6px 8px;
  }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 150px 190px; gap: 6px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; overflow-y: auto; }
  li { display: grid; grid-template-columns: 30px 1fr 36px 12px; gap: 4px; }
  li.picked { background: var(--rust); }
  .slot { color: var(--leaf); }
  .fit { text-align: right; font-variant-numeric: tabular-nums; }
  .card { color: var(--gold); }
  .name { all: unset; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name:focus-visible { outline: 1px solid var(--gold); }
  .side { display: flex; flex-direction: column; gap: 6px; }
  .sub { display: flex; justify-content: space-between; align-items: center; gap: 4px; }
  .x { padding: 0 4px; }
  .opts { display: flex; flex-wrap: wrap; gap: 3px; }
  .opts .btn { padding: 0 4px; }
  .foot { display: flex; align-items: center; gap: 6px; }
  .spacer { flex: 1; }
  .none { flex: 1; }
</style>
