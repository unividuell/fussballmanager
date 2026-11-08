<script lang="ts">
  import { untrack } from "svelte";
  import type { MatchEvent, MatchId, Score } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { liveLayout, managedMatchIds } from "../live/layout";
  import LiveTable from "../live/LiveTable.svelte";
  import MatchPanel from "../live/MatchPanel.svelte";
  import { Playback, type ActiveScene } from "../live/playback";
  import { loadSceneImages } from "../live/sceneRender";
  import { TEMPOS, halfBounds, whistleDue } from "../logic/ticker";

  let { controller, half }: { controller: GameController; half: 1 | 2 } = $props();

  const FRAME_MS = 33;
  const FLASH_MS = 1000;

  // Alles, was zu Beginn der Halbzeit feststeht: Spiele, Aufteilung, Wiedergabe.
  const snap = untrack(() => controller.snapshot!);
  const gs = snap.state;
  const lives = snap.lives;
  const bounds = untrack(() => halfBounds(half));
  const managed = managedMatchIds(gs, lives);
  const layout = liveLayout(gs, lives);
  const playback = new Playback({ lives, managed, ...bounds, scenes: untrack(() => controller.options.scenes) });
  void loadSceneImages();

  let minute = $state(bounds.from);
  let sceneRunning = $state(false);
  let version = $state(0);
  let flashing = $state<MatchId[]>([]);
  let advanced = false;

  const tempo = $derived(controller.options.tempo);
  const now = () => Date.now();

  function onRevealed(events: MatchEvent[], withEffects: boolean): void {
    if (!withEffects) return;
    const goals = events.filter((e) => e.type === "goal" && lives.some((l) => managed.includes(l.matchId) && (l.home.club === e.club || l.away.club === e.club)));
    if (goals.length === 0) return;
    controller.playSound("goal");
    const ids = lives.filter((l) => goals.some((g) => g.club === l.home.club || g.club === l.away.club)).map((l) => l.matchId);
    flashing = [...flashing, ...ids];
    setTimeout(() => (flashing = flashing.filter((id) => !ids.includes(id))), FLASH_MS);
  }

  function sync(): void {
    minute = playback.minute;
    sceneRunning = playback.sceneRunning;
    version++;
  }

  function stepClock(): void {
    const from = playback.minute;
    onRevealed(playback.step(now()), true);
    if (whistleDue(from, playback.minute, bounds.to)) controller.playSound("whistle");
    sync();
  }

  function skip(): void {
    if (playback.finished) return;
    const from = playback.minute;
    playback.skipToEnd();
    if (whistleDue(from, playback.minute, bounds.to)) controller.playSound("whistle");
    sync();
  }

  // Uhr: eine Minute pro Takt; solange eine Szene läuft, im langsamsten Tempo.
  $effect(() => {
    if (minute >= bounds.to) return;
    const ms = sceneRunning ? TEMPOS[0] : TEMPOS[tempo];
    const timer = setTimeout(stepClock, ms);
    return () => clearTimeout(timer);
  });

  // Szenen fortschreiben, solange eine läuft.
  $effect(() => {
    if (!sceneRunning) return;
    const timer = setInterval(() => {
      onRevealed(playback.update(now()), true);
      sync();
    }, FRAME_MS);
    return () => clearInterval(timer);
  });

  // `version` steigt nach jeder Änderung der Wiedergabe; daran hängen alle abgeleiteten Anzeigewerte.
  const finished = $derived.by(() => {
    void version;
    return minute >= bounds.to && playback.finished;
  });
  const scores = $derived.by(() => {
    void version;
    const out: Record<MatchId, Score> = {};
    for (const l of lives) out[l.matchId] = playback.score(l.matchId);
    return out;
  });
  const panels = $derived.by(() => {
    void version;
    const t = now();
    const out: Record<MatchId, { revealed: MatchEvent[]; active: ActiveScene | null }> = {};
    for (const l of lives) out[l.matchId] = { revealed: [...playback.revealed(l.matchId)], active: playback.active(l.matchId, t) };
    return out;
  });

  function setTempo(t: number): void {
    controller.setOptions({ tempo: Math.max(0, Math.min(TEMPOS.length - 1, t)) });
  }

  function next(): void {
    if (!finished || advanced) return;
    advanced = true;
    controller.advance();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case "+":
        setTempo(tempo + 1);
        break;
      case "-":
        setTempo(tempo - 1);
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

<div class="live">
  <div class="stage">
    <div class="slots" class:full={layout.full}>
      {#each layout.slots as slot, i (i)}
        <div class="slot">
          {#if slot.kind === "match"}
            {@const live = lives.find((l) => l.matchId === slot.matchId)!}
            <MatchPanel
              state={gs}
              {live}
              {minute}
              score={scores[live.matchId]}
              revealed={panels[live.matchId].revealed}
              active={panels[live.matchId].active}
              flash={flashing.includes(live.matchId)}
            />
          {:else}
            <LiveTable state={gs} competitionId={slot.competitionId} {scores} />
          {/if}
        </div>
      {/each}
    </div>
  </div>
  <div class="foot">
    <span class="clock">{half}. Halbzeit · {minute}'</span>
    <button class="btn" onclick={() => setTempo(tempo - 1)}>−</button>
    <span class="tempo">Tempo {tempo + 1}/3</span>
    <button class="btn" onclick={() => setTempo(tempo + 1)}>+</button>
    <button class="btn" onclick={skip} disabled={finished}>Überspringen (Leertaste)</button>
    <span class="spacer"></span>
    {#if finished}
      <strong class="end">{half === 1 ? "HALBZEIT" : "ABPFIFF"}</strong>
      <button class="btn primary" onclick={next}>Weiter (Enter)</button>
    {/if}
  </div>
</div>

<style>
  /* Vier Viertel à 640×400 ergeben 1280×800; die Fußleiste braucht 56 px, deshalb wird das Raster auf 744/800 verkleinert. */
  .live { display: flex; flex-direction: column; height: 100%; background: var(--ink); }
  .stage { position: relative; height: 744px; display: flex; justify-content: center; overflow: hidden; }
  .slots { width: 1280px; height: 800px; flex: none; display: grid; grid-template-columns: 640px 640px; grid-template-rows: 400px 400px; transform: scale(0.93); transform-origin: top center; }
  .slots.full { grid-template-columns: 1280px; grid-template-rows: 800px; }
  .slot { position: relative; width: 640px; height: 400px; overflow: hidden; }
  .slots.full .slot { width: 1280px; height: 800px; }
  .slots.full .slot > :global(.match) { transform: scale(2); transform-origin: top left; }
  .foot { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 16px; box-sizing: border-box; background: var(--wood); border-top: 4px solid var(--wood-edge); }
  .foot .btn { padding: 2px 12px; }
  .clock { font-family: var(--font-display); font-size: 16px; color: var(--cream); }
  .tempo { color: var(--leaf); }
  .spacer { flex: 1; }
  .end { font-family: var(--font-display); font-weight: normal; font-size: 16px; color: var(--gold); }
</style>
