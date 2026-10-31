<script lang="ts">
  import { COMP, type ClubId } from "../../engine/model";
  import { leagueOf } from "../../engine/season";
  import type { GameController } from "../controller.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();
  let advanced = false;

  const snap = $derived(controller.snapshot!);
  const gs = $derived(snap.state);
  const record = $derived(snap.phase.kind === "seasonEnd" ? snap.phase.record : null);
  const names = (ids: ClubId[]) => ids.map((id) => gs.clubs[id].name).join(", ");

  function scorer(competitionId: string): string {
    const s = record?.topScorers[competitionId];
    if (!s) return "–";
    const p = gs.players[s.player];
    return `${p ? `${p.firstName} ${p.lastName}` : "?"} (${s.goals} Tore)`;
  }

  function next(): void {
    if (advanced) return;
    advanced = true;
    controller.advance();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      next();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if record}
  <div class="seasonend">
    <h1>SAISON {record.season} BEENDET</h1>
    <div class="cols">
      <Panel title="CHRONIK">
        <p>Meister 1. Liga: <b>{gs.clubs[record.champions[COMP.first]].name}</b></p>
        <p>Meister 2. Liga: <b>{gs.clubs[record.champions[COMP.second]].name}</b></p>
        <p>Aufsteiger: {names(record.promoted)}</p>
        <p>Absteiger: {names(record.relegated)}</p>
        <p>Torschützenkönig 1. Liga: {scorer(COMP.first)}</p>
        <p>Torschützenkönig 2. Liga: {scorer(COMP.second)}</p>
      </Panel>
      <Panel title="MANAGER">
        {#each gs.managers as m (m.id)}
          {@const league = m.clubId ? leagueOf(gs, m.clubId) : null}
          <p>{m.name}: {m.clubId ? gs.clubs[m.clubId].name : "ohne Verein"}{league ? ` – nächste Saison ${gs.competitions[league].name}` : ""}</p>
        {/each}
      </Panel>
    </div>
    <div class="foot">
      <span class="spacer"></span>
      <button class="btn primary" onclick={next}>Neue Saison (Enter)</button>
    </div>
  </div>
{/if}

<style>
  .seasonend { display: flex; flex-direction: column; height: 100%; padding: 12px; box-sizing: border-box; gap: 8px; }
  .cols { flex: 1; display: grid; grid-template-columns: 3fr 2fr; gap: 8px; min-height: 0; }
  p { margin: 0; font-size: 17px; }
  b { color: var(--gold); font-weight: normal; }
  .foot { display: flex; }
  .spacer { flex: 1; }
</style>
