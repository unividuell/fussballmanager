<script lang="ts">
  import { overdraftLimit } from "../../engine/economy/money";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { ledgerSummary } from "../logic/economy";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const f = $derived(club.finance);
  const summary = $derived(ledgerSummary(club, gs.calendarIndex));

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="finance">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <Panel title="BILANZ">
      <table class="board-table">
        <thead><tr><th>Kategorie</th><th class="num">Letzter Spieltag</th><th class="num">Saison</th></tr></thead>
        <tbody>
          {#each summary.lines as l (l.category)}
            <tr><td>{l.label}</td><td class="num">{formatEuro(l.lastMatchday)}</td><td class="num">{formatEuro(l.season)}</td></tr>
          {/each}
          <tr class="sum"><td>Summe</td><td class="num">{formatEuro(summary.lastTotal)}</td><td class="num">{formatEuro(summary.seasonTotal)}</td></tr>
        </tbody>
      </table>
      <p>Kontostand: <b class:negative={f.balance < 0}>{formatEuro(f.balance)}</b> · Dispo-Limit: {formatEuro(overdraftLimit(club.reputation))}</p>
    </Panel>
    <div class="side">
      <Panel title="SPONSOR">
        {#if f.sponsor}
          <p>{f.sponsor.name}: {formatEuro(f.sponsor.perMatchday)} pro Spieltag, Prämie {formatEuro(f.sponsor.bonus)}</p>
        {:else}
          {#each f.sponsorOffers as o (o.id)}
            <div class="row">
              <span>{o.name}: {formatEuro(o.perMatchday)} / Sp., Prämie {formatEuro(o.bonus)}</span>
              <button class="btn" aria-label="{o.name} wählen" onclick={() => void controller.send({ type: "chooseSponsor", managerId, offerId: o.id })}>Wählen</button>
            </div>
          {/each}
        {/if}
      </Panel>
    </div>
  </div>
  <div class="foot">
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .finance { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; overflow-y: auto; }
  .side { display: flex; flex-direction: column; gap: 12px; }
  p { margin: 0; font-size: 23px; }
  .row { display: flex; align-items: center; gap: 12px; justify-content: space-between; font-size: 23px; }
  .sum td { color: var(--gold); border-top: 2px solid var(--wood-edge); }
  b { font-weight: normal; color: var(--leaf); }
  b.negative { color: var(--rust); }
  .foot { display: flex; gap: 12px; padding: 0 16px 12px; }
  .spacer { flex: 1; }
</style>
