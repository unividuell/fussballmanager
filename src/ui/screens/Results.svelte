<script lang="ts">
  import { COMP } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { competitionName, competitionsOf, tickerRows } from "../logic/ticker";
  import { eventText } from "../logic/format";
  import Panel from "../theme/Panel.svelte";

  let { controller }: { controller: GameController } = $props();
  let advanced = false;

  const snap = $derived(controller.snapshot!);
  const gs = $derived(snap.state);
  const rows = $derived(tickerRows(gs, snap.lives, 90));
  const comps = $derived(competitionsOf(snap.lives));

  const humanClubs = $derived(
    new Set(gs.managers.map((m) => m.clubId).filter((c): c is string => c !== null)),
  );
  const happenings = $derived(
    snap.lives.flatMap((l) =>
      l.events
        .filter((e) => (e.type === "goal" || e.type === "red" || e.type === "injury") && humanClubs.has(e.club))
        .map((e) => `${gs.clubs[e.club].shortName}: ${eventText(gs, e)}`),
    ),
  );

  const title = $derived.by(() => {
    const l = snap.lives[0];
    if (!l) return "";
    if (l.competitionId === COMP.relegation) return "Relegation";
    const m = gs.competitions[l.competitionId].matches.find((x) => x.id === l.matchId);
    return `${m?.round ?? "?"}. Spieltag`;
  });

  function penalties(matchId: string, competitionId: string): string {
    const m = gs.competitions[competitionId]?.matches.find((x) => x.id === matchId);
    return m?.penalties ? ` (i.E. ${m.penalties.home}:${m.penalties.away})` : "";
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

<div class="results">
  <h1>ERGEBNISSE · {title}</h1>
  <div class="cols">
    {#each comps as c (c)}
      <Panel title={competitionName(gs, c).toUpperCase()}>
        {#each rows.filter((r) => r.competitionId === c) as r (r.matchId)}
          <div class="result" class:managed={r.managed}>
            <span class="home">{gs.clubs[r.homeClub].shortName}</span>
            <span class="score">{r.homeGoals}:{r.awayGoals}{penalties(r.matchId, c)}</span>
            <span class="away">{gs.clubs[r.awayClub].shortName}</span>
          </div>
        {/each}
      </Panel>
    {/each}
  </div>
  {#if happenings.length > 0}
    <Panel title="EREIGNISSE">
      {#each happenings as h, i (i)}
        <p class="event">{h}</p>
      {/each}
    </Panel>
  {/if}
  {#if snap.notices.length > 0}
    <Panel title="HINWEISE">
      {#each snap.notices as n, i (i)}
        <p class="notice">{controller.managerName(n.managerId)}: {n.text}</p>
      {/each}
    </Panel>
  {/if}
  <div class="foot">
    <button class="btn" onclick={() => controller.setResultsTables(true)}>Tabelle</button>
    <span class="spacer"></span>
    <button class="btn primary" onclick={next}>Weiter (Enter)</button>
  </div>
</div>

<style>
  .results { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
  h1 { font-size: 8px; }
  .cols { flex: 1; min-height: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
  .result { display: grid; grid-template-columns: 1fr 70px 1fr; gap: 4px; font-size: 17px; }
  .home { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .away { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { text-align: center; color: var(--gold); font-variant-numeric: tabular-nums; }
  .result.managed .home,
  .result.managed .away { color: var(--gold); }
  .notice,
  .event { margin: 0; }
  .foot { display: flex; gap: 6px; }
  .spacer { flex: 1; }
</style>
