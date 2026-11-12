<script lang="ts">
  import { WARN_BELOW, expectationLabel } from "../../engine/economy/board";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { boardRemark, confidenceTrend, targetRange } from "../logic/board";
  import { clubPlace } from "../logic/tables";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const board = $derived(club.board);
  const place = $derived(clubPlace(gs, club.id));
  const range = $derived(targetRange(board.expectation));
  const label = $derived(place ? expectationLabel(board.expectation, place.competitionId) : "");
  const leagueName = (id: string) => gs.competitions[id]?.name ?? id;
  const places = Array.from({ length: 18 }, (_, i) => i + 1);

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="boardscreen">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <Panel title="VORSTAND">
      <div class="row">
        <span class="goal">Saisonziel: {label} (Platz {range[0]}–{range[1]})</span>
        {#if club.finance.sponsor}<span>Sponsorbonus: {formatEuro(club.finance.sponsor.bonus)}</span>{/if}
      </div>
      <ul class="ladder" aria-label="Tabellenplätze">
        {#each places as p (p)}
          <li class:target={p <= range[1]} class:me={place?.rank === p}>{p}</li>
        {/each}
      </ul>
      <div class="row">
        <span>Vertrauen: {Math.round(board.confidence)} / 100</span>
        <span>Trend: {confidenceTrend(board.trend)}</span>
      </div>
      <div class="bar" role="meter" aria-label="Vertrauen" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(board.confidence)}>
        <span class="fill" style="width: {board.confidence}%"></span>
        <span class="mark" style="left: {WARN_BELOW}%"></span>
      </div>
      <p class="small">Unter {WARN_BELOW} meldet sich der Vorstand. Entlassen wird niemand.</p>
      {#if place}<p class="remark">„{boardRemark(place.rank, board.expectation)}“</p>{/if}
    </Panel>
    <Panel title="BISHERIGE SAISONS">
      <table class="board-table" aria-label="Bisherige Saisons">
        <thead><tr><th>Saison</th><th>Liga</th><th>Ziel</th><th class="num">Platz</th><th></th></tr></thead>
        <tbody>
          {#each board.seasons as s (s.season)}
            <tr>
              <td>{s.season}</td>
              <td>{leagueName(s.competitionId)}</td>
              <td>{expectationLabel(s.expectation, s.competitionId)}</td>
              <td class="num">{s.rank}.</td>
              <td class:ok={s.met} class:bad={!s.met}>{s.met ? "erreicht" : "verfehlt"}</td>
            </tr>
          {/each}
          <tr>
            <td>{gs.season}</td>
            <td>{place ? leagueName(place.competitionId) : ""}</td>
            <td>{label}</td>
            <td class="num"></td>
            <td>läuft</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  </div>
  <div class="foot">
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .boardscreen { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 3fr 2fr; gap: 16px; padding: 16px; align-content: start; overflow-y: auto; }
  p { margin: 0; font-size: 23px; }
  .row { display: flex; justify-content: space-between; gap: 12px; font-size: 23px; flex-wrap: wrap; }
  .goal { color: var(--gold); }
  .small { font-size: 20px; color: var(--leaf); }
  .remark { font-style: italic; }
  .ladder { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(18, 1fr); gap: 4px; }
  .ladder li { text-align: center; font-size: 20px; background: var(--wood-dark); border: 2px solid var(--wood-edge); color: var(--wood-edge); }
  .ladder li.target { background: var(--grass-1); border-color: var(--leaf); color: var(--leaf); }
  .ladder li.me { background: var(--gold); border-color: var(--cream); color: var(--wood-dark); }
  .bar { position: relative; height: 20px; background: var(--wood-dark); border: 4px solid var(--wood-edge); }
  .fill { position: absolute; inset: 0 auto 0 0; background: var(--leaf); }
  .mark { position: absolute; top: -6px; bottom: -6px; width: 4px; background: var(--rust); }
  .ok { color: var(--leaf); }
  .bad { color: var(--rust); }
  .foot { display: flex; gap: 12px; padding: 0 16px 12px; }
  .spacer { flex: 1; }
</style>
