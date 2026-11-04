<script lang="ts">
  import { severance } from "../../engine/economy/contracts";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId, type PlayerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { contractRows } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";
  import NegotiationDialog from "./NegotiationDialog.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const rows = $derived(contractRows(gs, club.id));
  let talkFor = $state<PlayerId | null>(null);
  let confirmFor = $state<PlayerId | null>(null);

  async function release(id: PlayerId): Promise<void> {
    confirmFor = null;
    await controller.send({ type: "releasePlayer", managerId, playerId: id });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (talkFor) talkFor = null;
    else if (confirmFor) confirmFor = null;
    else controller.open("menu");
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="contracts">
  <ClubHeader {controller} {managerId} />
  <Panel title="VERTRÄGE" class="list">
    <div class="scroll">
      <table class="board-table">
        <thead>
          <tr><th>Name</th><th>Pos</th><th class="num">Alter</th><th class="num">St</th><th class="num">Gehalt</th><th>bis</th><th class="num">Forderung</th><th></th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.player.id)}
            <tr class:expiring={r.expiring}>
              <td>{playerName(r.player)}</td>
              <td>{POSITION_LABEL[r.player.position]}</td>
              <td class="num">{r.player.age}</td>
              <td class="num">{Math.round(r.player.strength)}</td>
              <td class="num">{formatEuro(r.salary)}</td>
              <td>{r.expiring ? "läuft aus" : `S${r.endsSeason}`}</td>
              <td class="num">{formatEuro(r.demand)}</td>
              <td class="actions">
                <button class="btn" aria-label="{playerName(r.player)} verlängern" onclick={() => (talkFor = r.player.id)}>Verlängern</button>
                <button class="btn" aria-label="{playerName(r.player)} entlassen" onclick={() => (confirmFor = r.player.id)}>Entlassen</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Panel>
  <div class="foot">
    {#if confirmFor && gs.players[confirmFor]}
      {@const p = gs.players[confirmFor]}
      <span class="msg">{playerName(p)} entlassen? Abfindung: {formatEuro(severance(gs, p))}</span>
      <button class="btn primary" onclick={() => void release(p.id)}>Ja, entlassen</button>
      <button class="btn" onclick={() => (confirmFor = null)}>Nein</button>
    {:else if controller.message}
      <span class="msg">{controller.message}</span>
    {/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
  {#if talkFor}
    <NegotiationDialog {controller} {managerId} playerId={talkFor} mode="contract" onClose={() => (talkFor = null)} />
  {/if}
</div>

<style>
  .contracts { display: flex; flex-direction: column; height: 100%; position: relative; }
  .contracts :global(.list) { flex: 1; min-height: 0; margin: 16px; }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .board-table { font-size: 23px; }
  tr.expiring td { color: var(--gold); }
  .actions { display: flex; gap: 8px; }
  .actions .btn { padding: 0 8px; font-size: 21px; }
  .foot { display: flex; align-items: center; gap: 12px; padding: 0 16px 12px; }
  .spacer { flex: 1; }
</style>
