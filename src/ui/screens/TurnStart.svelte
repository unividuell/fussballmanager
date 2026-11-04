<script lang="ts">
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import Crest from "../theme/Crest.svelte";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();
  const club = $derived(clubOf(controller.snapshot!.state, managerId));

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      controller.open(club ? "menu" : "jobs");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="turn">
  <ClubHeader {controller} {managerId} />
  <div class="center">
    <Panel>
      <div class="card">
        {#if club}<Crest colors={club.colors} pattern={club.crest} size={48} />{/if}
        <h1>{controller.managerName(managerId).toUpperCase()} IST DRAN</h1>
        {#if club}
          <p>{club.name}</p>
          <button class="btn primary" onclick={() => controller.open("menu")}>Los geht's (Enter)</button>
        {:else}
          <p>Ohne Verein</p>
          <button class="btn primary" onclick={() => controller.open("jobs")}>Jobangebote (Enter)</button>
        {/if}
        {#if controller.autosaveFailed}
          <p class="warn">Autosave fehlgeschlagen – der Spielstand wird nicht automatisch gespeichert.</p>
        {/if}
      </div>
    </Panel>
  </div>
</div>

<style>
  .turn { display: flex; flex-direction: column; height: 100%; }
  .center { flex: 1; display: grid; place-items: center; }
  .card { display: grid; justify-items: center; gap: 10px; padding: 12px 28px; }
  p { margin: 0; font-size: 20px; }
  .warn { font-size: 16px; color: var(--rust); }
</style>
