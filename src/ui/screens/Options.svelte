<script lang="ts">
  import type { GameController } from "../controller.svelte";
  import { TEMPO_LABELS } from "../logic/options";
  import Panel from "../theme/Panel.svelte";

  let { controller, onBack }: { controller: GameController; onBack: () => void } = $props();
  const o = $derived(controller.options);

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onBack();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="options">
  <Panel title="OPTIONEN">
    <div class="row">
      <span class="label">Scanlines</span>
      <button class="btn" class:selected={o.scanlines} aria-pressed={o.scanlines} aria-label="Scanlines an" onclick={() => controller.setOptions({ scanlines: true })}>An</button>
      <button class="btn" class:selected={!o.scanlines} aria-pressed={!o.scanlines} aria-label="Scanlines aus" onclick={() => controller.setOptions({ scanlines: false })}>Aus</button>
    </div>
    <div class="row">
      <span class="label">Konferenz-Tempo</span>
      {#each TEMPO_LABELS as label, i (label)}
        <button class="btn" class:selected={o.tempo === i} aria-pressed={o.tempo === i} aria-label="Tempo {label}" onclick={() => controller.setOptions({ tempo: i })}>{label}</button>
      {/each}
    </div>
    <div class="row">
      <span class="label">Ton</span>
      <button class="btn" class:selected={o.sound} aria-pressed={o.sound} aria-label="Ton an" onclick={() => controller.setOptions({ sound: true })}>An</button>
      <button class="btn" class:selected={!o.sound} aria-pressed={!o.sound} aria-label="Ton aus" onclick={() => controller.setOptions({ sound: false })}>Aus</button>
    </div>
    <p class="hint">Ton: kurze Signale bei Toren der Manager-Vereine und beim Abpfiff.</p>
  </Panel>
  <div class="foot">
    <span class="spacer"></span>
    <button class="btn" onclick={onBack}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .options { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 12px; box-sizing: border-box; }
  .row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .label { width: 160px; color: var(--leaf); }
  .hint { margin: 0; color: var(--leaf); }
  .foot { display: flex; margin-top: auto; }
  .spacer { flex: 1; }
</style>
