<script lang="ts">
  import { STADIUM } from "../../engine/economy/stadium";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { INVALID_AMOUNT, parseEuro } from "../logic/economy";
  import { hasPlayedHome, priceHint } from "../logic/stadium";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const f = $derived(club.finance);
  const capacity = $derived(STADIUM[f.stadiumStage].capacity);
  const next = $derived(STADIUM[f.stadiumStage + 1] ?? null);
  const playedHome = $derived(hasPlayedHome(gs, club.id));
  const hint = $derived(priceHint(f.lastAttendance, capacity, playedHome));
  const seats = (n: number) => n.toLocaleString("de-DE");

  function initialPrice(): string {
    return String(clubOf(controller.snapshot!.state, managerId)?.finance.ticketPrice ?? 20);
  }
  let priceText = $state(initialPrice());
  let note = $state<string | null>(null);

  function setPrice(): void {
    const price = parseEuro(priceText);
    if (price === null) {
      note = INVALID_AMOUNT;
      return;
    }
    note = null;
    void controller.send({ type: "setTicketPrice", managerId, price });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="stadium">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <Panel title="STADION">
      <p>Stufe {f.stadiumStage + 1} von {STADIUM.length}: {seats(capacity)} Plätze</p>
      {#if playedHome}
        <p>Letztes Heimspiel: {seats(f.lastAttendance)} von {seats(capacity)} ({Math.round((100 * f.lastAttendance) / capacity)} %)</p>
      {:else}
        <p>Noch kein Heimspiel in dieser Saison.</p>
      {/if}
      {#if f.building}<p>Ausbau läuft: noch {f.building.matchdaysLeft} Spieltage</p>{/if}
      {#if next}
        <button class="btn" disabled={f.building !== null} onclick={() => void controller.send({ type: "buildStadium", managerId })}>
          Ausbauen: {seats(next.capacity)} Plätze für {formatEuro(next.cost)} ({next.buildMatchdays} Spieltage)
        </button>
        <p class="small">Unterhalt danach: {formatEuro(next.upkeep)} pro Spieltag statt {formatEuro(STADIUM[f.stadiumStage].upkeep)}</p>
      {:else}
        <p>Höchste Ausbaustufe erreicht.</p>
      {/if}
    </Panel>
    <Panel title="EINTRITT">
      <p>Preis: {formatEuro(f.ticketPrice)}</p>
      {#if hint}<p class="hint">{hint}</p>{/if}
      <div class="row">
        <input aria-label="Eintrittspreis" inputmode="numeric" size="4" bind:value={priceText} />
        <button class="btn" onclick={setPrice}>Preis setzen</button>
      </div>
    </Panel>
  </div>
  <div class="foot">
    {#if note}<span class="msg">{note}</span>{:else if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .stadium { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; align-content: start; overflow-y: auto; }
  p { margin: 0; font-size: 23px; }
  .small { font-size: 20px; color: var(--leaf); }
  .hint { color: var(--gold); }
  .row { display: flex; align-items: center; gap: 12px; font-size: 23px; }
  input { width: 128px; font-family: var(--font-body); font-size: 24px; color: var(--cream); background: var(--wood-dark); border: 4px solid var(--wood-edge); }
  .foot { display: flex; gap: 12px; padding: 0 16px 12px; }
  .spacer { flex: 1; }
</style>
