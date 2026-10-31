<script lang="ts">
  import { leagueOf } from "../../engine/season";
  import type { GameController } from "../controller.svelte";
  import { DEFAULT_TEMPO, TEMPOS, competitionName, competitionsOf, halfBounds, tickerRows } from "../logic/ticker";
  import Panel from "../theme/Panel.svelte";

  let { controller, half }: { controller: GameController; half: 1 | 2 } = $props();

  function startMinute(): number {
    return halfBounds(half).from;
  }

  function initialCompIndex(): number {
    const snap = controller.snapshot!;
    for (const m of snap.state.managers) {
      if (!m.clubId) continue;
      const i = competitionsOf(snap.lives).indexOf(leagueOf(snap.state, m.clubId) ?? "");
      if (i >= 0) return i;
    }
    return 0;
  }

  const bounds = $derived(halfBounds(half));
  let minute = $state(startMinute());
  let tempo = $state(DEFAULT_TEMPO);
  let compIndex = $state(initialCompIndex());
  let advanced = false;

  const gs = $derived(controller.snapshot!.state);
  const lives = $derived(controller.snapshot!.lives);
  const comps = $derived(competitionsOf(lives));
  const comp = $derived(comps[compIndex % Math.max(1, comps.length)]);
  const rows = $derived(tickerRows(gs, lives, minute, Math.ceil(1000 / TEMPOS[tempo])).filter((r) => r.competitionId === comp));
  const finished = $derived(minute >= bounds.to);

  $effect(() => {
    if (minute >= bounds.to) return;
    const timer = setTimeout(() => {
      minute = Math.min(bounds.to, minute + 1);
    }, TEMPOS[tempo]);
    return () => clearTimeout(timer);
  });

  function skip(): void {
    minute = bounds.to;
  }

  function next(): void {
    if (!finished || advanced) return;
    advanced = true;
    controller.advance();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case "Tab":
        e.preventDefault();
        compIndex = (compIndex + 1) % Math.max(1, comps.length);
        break;
      case "+":
        tempo = Math.min(TEMPOS.length - 1, tempo + 1);
        break;
      case "-":
        tempo = Math.max(0, tempo - 1);
        break;
      case " ":
        e.preventDefault();
        skip();
        break;
      case "Enter":
        e.preventDefault();
        next();
        break;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="conference">
  <div class="bar">
    <span>KONFERENZ · {competitionName(gs, comp)}</span>
    <span class="clock">{minute}'</span>
    <span>{half}. Halbzeit</span>
  </div>
  <Panel class="board">
    {#each rows as r (r.matchId)}
      <div class="row" class:goal={r.goalNow} class:managed={r.managed}>
        <span class="home">{r.home}</span>
        <span class="score">{r.homeGoals}:{r.awayGoals}</span>
        <span class="away">{r.away}</span>
        <span class="last">{r.last ?? ""}</span>
      </div>
    {/each}
  </Panel>
  <div class="foot">
    <button class="btn" onclick={() => (compIndex = (compIndex + 1) % Math.max(1, comps.length))}>Liga (TAB)</button>
    <button class="btn" onclick={() => (tempo = Math.max(0, tempo - 1))}>−</button>
    <span class="tempo">Tempo {tempo + 1}/3</span>
    <button class="btn" onclick={() => (tempo = Math.min(TEMPOS.length - 1, tempo + 1))}>+</button>
    <button class="btn" onclick={skip} disabled={finished}>Überspringen (Leertaste)</button>
    <span class="spacer"></span>
    {#if finished}
      <strong class="end">{half === 1 ? "HALBZEIT" : "ABPFIFF"}</strong>
      <button class="btn primary" onclick={next}>Weiter (Enter)</button>
    {/if}
  </div>
</div>

<style>
  .conference { display: flex; flex-direction: column; height: 100%; padding: 8px; box-sizing: border-box; gap: 6px; }
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
  .clock { color: var(--cream); }
  .conference :global(.board) { flex: 1; justify-content: space-around; }
  .row { display: grid; grid-template-columns: 1fr 44px 1fr 150px; gap: 8px; font-size: 17px; padding: 0 4px; }
  .home { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .away { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { text-align: center; color: var(--gold); font-variant-numeric: tabular-nums; }
  .last { color: var(--leaf); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.managed .home,
  .row.managed .away { color: var(--gold); }
  .row.goal { background: var(--rust); }
  @media (prefers-reduced-motion: no-preference) {
    .row.goal { animation: blink 0.5s steps(1) 2; }
    @keyframes blink { 50% { background: transparent; } }
  }
  .foot { display: flex; align-items: center; gap: 6px; }
  .foot .btn { padding: 1px 6px; }
  .tempo { color: var(--leaf); }
  .spacer { flex: 1; }
  .end { font-family: var(--font-display); font-weight: normal; font-size: 8px; color: var(--gold); }
</style>
