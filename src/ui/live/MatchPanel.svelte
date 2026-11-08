<script lang="ts">
  import type { LiveMatch } from "../../engine/match/simulate";
  import type { GameState, MatchEvent, Score } from "../../engine/model";
  import Crest from "../theme/Crest.svelte";
  import type { ActiveScene } from "./playback";
  import PressureGraph from "./PressureGraph.svelte";
  import { pressureCurve } from "./pressure";
  import SceneView from "./SceneView.svelte";
  import { liveEventText } from "./scenes";

  let {
    state,
    live,
    minute,
    score,
    revealed,
    active,
    flash,
  }: { state: GameState; live: LiveMatch; minute: number; score: Score; revealed: MatchEvent[]; active: ActiveScene | null; flash: boolean } = $props();

  const home = $derived(state.clubs[live.home.club]);
  const away = $derived(state.clubs[live.away.club]);
  const curve = $derived(pressureCurve(live));
  const shots = $derived(revealed.filter((e) => e.type === "goal" || e.type === "chance"));
  const marks = $derived(shots.map((e) => ({ minute: e.minute, home: e.club === live.home.club, goal: e.type === "goal" })));
  const chances = $derived([marks.filter((m) => m.home).length, marks.filter((m) => !m.home).length] as [number, number]);
  const lines = $derived(
    revealed
      .slice(-3)
      .reverse()
      .map((e) => ({ text: liveEventText(state, live, e), goal: e.type === "goal" })),
  );
</script>

<div class="match">
  {#if active}
    <SceneView
      {state}
      scene={active.scene}
      defender={active.scene.home ? live.away.club : live.home.club}
      elapsed={active.elapsed}
      revealed={active.revealed}
    />
  {:else}
    <div class="hdr">
      <span class="club"><Crest colors={home.colors} pattern={home.crest} size={32} /> {home.shortName}</span>
      <span class="score" class:flash>{score.home}:{score.away}</span>
      <span class="club away"><Crest colors={away.colors} pattern={away.crest} size={32} /> {away.shortName}</span>
      <span class="min">{minute}'</span>
    </div>
    <div class="body">
      <PressureGraph {curve} {minute} {marks} homeColor={home.colors[0]} awayColor={away.colors[0]} homeName={home.shortName} awayName={away.shortName} {chances} />
    </div>
    <div class="tick">
      {#each lines as l, i (i)}
        <div class:g={l.goal}>{l.text}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .match {
    position: relative;
    width: 640px;
    height: 400px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: repeating-linear-gradient(90deg, var(--grass-1) 0 80px, var(--grass-2) 80px 160px);
    overflow: hidden;
  }
  .hdr { display: flex; align-items: center; gap: 12px; height: 60px; padding: 0 12px; background: var(--wood); border-bottom: 4px solid var(--wood-edge); }
  .club { display: flex; align-items: center; gap: 8px; font-size: 24px; white-space: nowrap; }
  .score { font-family: var(--font-display); font-size: 24px; color: var(--gold); padding: 2px 6px; }
  .min { margin-left: auto; font-family: var(--font-display); font-size: 16px; }
  .body { flex: 1; padding: 12px 16px 8px; min-height: 0; }
  .tick { height: 96px; box-sizing: border-box; padding: 4px 12px; background: var(--wood); border-top: 4px solid var(--wood-edge); font-size: 24px; line-height: 28px; overflow: hidden; }
  .tick div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--leaf); }
  .tick div:first-child { color: var(--cream); }
  .tick div.g { color: var(--gold); }
  @media (prefers-reduced-motion: no-preference) {
    .score.flash { animation: blink 0.5s steps(1) 2; }
    @keyframes blink { 50% { background: var(--rust); color: var(--cream); } }
  }
</style>
