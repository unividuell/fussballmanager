<script lang="ts">
  import type { ClubId, GameState } from "../../engine/model";
  import { keeperColor, planShot, renderScene, sceneSheets } from "./sceneRender";
  import { sceneLabel, type SceneEvent } from "./scenes";

  let {
    state: gs,
    scene,
    defender: defenderId,
    elapsed,
    revealed,
  }: { state: GameState; scene: SceneEvent; defender: ClubId; elapsed: number; revealed: boolean } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  const plan = $derived(planShot(scene));
  const attacker = $derived(gs.clubs[scene.club]);
  const defender = $derived(gs.clubs[defenderId]);
  const label = $derived(sceneLabel(scene));
  const shooterName = $derived(gs.players[scene.player]?.lastName ?? "?");

  $effect(() => {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    // Sheets bei jedem Bild holen: Solange die Bilder noch laden, kommt ein leeres Canvas, danach der Cache.
    const sheets = sceneSheets(attacker.colors[0], attacker.colors[1], keeperColor(defender.colors));
    renderScene(ctx, plan, elapsed, sheets);
  });
</script>

<div class="scene">
  <canvas bind:this={canvas} width="320" height="200"></canvas>
  <div class="cap"><b>GROSSCHANCE {scene.minute}'</b> {shooterName} · {attacker.name}</div>
  {#if revealed}<div class="out" class:goal={scene.outcome === "goal"}>{label}</div>{/if}
</div>

<style>
  .scene { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--ink); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
  .cap { position: absolute; left: 0; right: 0; top: 0; padding: 4px 12px; background: var(--wood); border-bottom: 4px solid var(--wood-edge); font-size: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cap b { font-family: var(--font-display); font-weight: normal; font-size: 16px; color: var(--gold); }
  .out { position: absolute; left: 0; right: 0; top: 52%; text-align: center; font-family: var(--font-display); font-size: 32px; color: var(--cream); text-shadow: 4px 4px 0 var(--ink); }
  .out.goal { color: var(--gold); }
</style>
