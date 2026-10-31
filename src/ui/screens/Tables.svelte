<script lang="ts">
  import { COMP, type CompetitionId, type ManagerId } from "../../engine/model";
  import { leagueOf } from "../../engine/season";
  import type { GameController } from "../controller.svelte";
  import { fixturesView, lastPlayedRound, tableView } from "../logic/tables";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId, onBack }: { controller: GameController; managerId: ManagerId | null; onBack: () => void } = $props();

  const gs = $derived(controller.snapshot!.state);
  const ownClub = $derived(managerId ? (gs.managers.find((m) => m.id === managerId)?.clubId ?? null) : null);
  const LEAGUES: { id: CompetitionId; label: string }[] = [
    { id: COMP.first, label: "1. Liga" },
    { id: COMP.second, label: "2. Liga" },
  ];

  /** Startwerte beim Öffnen: eigene Liga (sonst 1. Liga) und zuletzt gespielter Spieltag. */
  function initial(): { league: CompetitionId; round: number } {
    const s = controller.snapshot!.state;
    const clubId = managerId ? (s.managers.find((m) => m.id === managerId)?.clubId ?? null) : null;
    const start = (clubId && leagueOf(s, clubId)) || COMP.first;
    return { league: start, round: lastPlayedRound(s, start) };
  }
  const start = initial();
  let league = $state<CompetitionId>(start.league);
  let round = $state(start.round);

  const rows = $derived(tableView(gs, league));
  const rounds = $derived(gs.competitions[league]?.rounds ?? 34);
  const fixtures = $derived(fixturesView(gs, league, round));

  function selectLeague(id: CompetitionId): void {
    league = id;
    round = lastPlayedRound(gs, id);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onBack();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="tables">
  <div class="tabs">
    {#each LEAGUES as l (l.id)}
      <button class="btn" class:selected={league === l.id} onclick={() => selectLeague(l.id)}>{l.label}</button>
    {/each}
    <span class="spacer"></span>
    <button class="btn" onclick={onBack}>Zurück (Esc)</button>
  </div>
  <div class="body">
    <Panel title="TABELLE">
      <table class="board-table" aria-label="Tabelle">
        <thead>
          <tr><th class="num">Pl</th><th>Verein</th><th class="num">Sp</th><th class="num">S</th><th class="num">U</th><th class="num">N</th><th class="num">Tore</th><th class="num">Pkt</th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.club)}
            <tr class:mine={r.manager !== null} class="zone-{r.zone ?? 'none'}">
              <td class="num">{r.rank}</td>
              <td>{r.name}{r.manager ? ` (${r.manager})` : ""}</td>
              <td class="num">{r.played}</td>
              <td class="num">{r.won}</td>
              <td class="num">{r.drawn}</td>
              <td class="num">{r.lost}</td>
              <td class="num">{r.goalsFor}:{r.goalsAgainst}</td>
              <td class="num">{r.points}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Panel>
    <Panel title="SPIELPLAN">
      <div class="nav">
        <button class="btn" aria-label="Vorheriger Spieltag" disabled={round <= 1} onclick={() => (round = Math.max(1, round - 1))}>◄</button>
        <span>{round}. Spieltag</span>
        <button class="btn" aria-label="Nächster Spieltag" disabled={round >= rounds} onclick={() => (round = Math.min(rounds, round + 1))}>►</button>
      </div>
      <ul aria-label="Spielplan">
        {#each fixtures as f (f.id)}
          <li class:mine={f.homeClub === ownClub || f.awayClub === ownClub}>
            <span class="team">{gs.clubs[f.homeClub].shortName}</span>
            <span class="res">{f.result ?? "–:–"}</span>
            <span class="team">{gs.clubs[f.awayClub].shortName}</span>
          </li>
        {/each}
      </ul>
    </Panel>
  </div>
</div>

<style>
  .tables { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  .tabs { display: flex; gap: 6px; }
  .spacer { flex: 1; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 226px; gap: 8px; }
  .board-table { font-size: 15px; line-height: 1; }
  tr.zone-champion td:first-child { box-shadow: inset 3px 0 var(--gold); }
  tr.zone-promotion td:first-child { box-shadow: inset 3px 0 var(--leaf); }
  tr.zone-playoff td:first-child { box-shadow: inset 3px 0 var(--cream); }
  tr.zone-relegation td:first-child { box-shadow: inset 3px 0 var(--rust); }
  .nav { display: flex; align-items: center; justify-content: space-between; }
  .nav .btn { padding: 0 6px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
  li { display: grid; grid-template-columns: 1fr 52px 1fr; gap: 4px; font-size: 15px; }
  li .team { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .team:first-child { text-align: right; }
  li .res { text-align: center; color: var(--gold); font-variant-numeric: tabular-nums; }
  li.mine .team { color: var(--gold); }
</style>
