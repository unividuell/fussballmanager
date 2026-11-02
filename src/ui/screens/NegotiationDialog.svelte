<script lang="ts">
  import { desiredYears, salaryDemand } from "../../engine/economy/contracts";
  import type { NegotiationResponse } from "../../engine/economy/negotiations";
  import { askingFee, isTransferWindow } from "../../engine/economy/transfers";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId, type PlayerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { latestNegotiation } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import Dialog from "../theme/Dialog.svelte";

  let {
    controller,
    managerId,
    playerId,
    mode,
    onClose,
  }: { controller: GameController; managerId: ManagerId; playerId: PlayerId; mode: "contract" | "transfer"; onClose: () => void } = $props();

  function initial(): { negotiationId: string | null; amount: string; years: string } {
    const s = controller.snapshot!.state;
    const p = s.players[playerId];
    const open = latestNegotiation(s, managerId, playerId);
    if (open && open.status === "open") return { negotiationId: open.id, amount: String(open.ask), years: String(open.desiredYears) };
    const clubId = clubOf(s, managerId)!.id;
    const amount = mode === "transfer" ? askingFee(s, p) : salaryDemand(s, p, clubId);
    return { negotiationId: null, amount: String(amount), years: String(desiredYears(p)) };
  }

  const start0 = initial();
  let negotiationId = $state<string | null>(start0.negotiationId);
  let amountText = $state(start0.amount);
  let yearsText = $state(start0.years);

  const gs = $derived(controller.snapshot!.state);
  const p = $derived(gs.players[playerId]);
  const n = $derived(negotiationId ? (gs.negotiations.find((x) => x.id === negotiationId) ?? null) : null);
  const stage = $derived(n ? n.stage : mode === "transfer" ? "fee" : "salary");

  function syncFromNegotiation(): void {
    const cur = negotiationId ? controller.snapshot!.state.negotiations.find((x) => x.id === negotiationId) : null;
    if (cur && cur.status === "open") amountText = String(cur.ask);
  }

  async function begin(): Promise<void> {
    const amount = Number(amountText);
    const ok =
      mode === "transfer"
        ? await controller.send({ type: "startTransferTalk", managerId, playerId, fee: amount })
        : await controller.send({ type: "startContractTalk", managerId, playerId, salary: amount, years: Number(yearsText) });
    if (!ok) return;
    negotiationId = latestNegotiation(controller.snapshot!.state, managerId, playerId)?.id ?? null;
    syncFromNegotiation();
  }

  async function respond(response: NegotiationResponse): Promise<void> {
    if (!n) return;
    await controller.send({ type: "respondNegotiation", managerId, negotiationId: n.id, response });
    syncFromNegotiation();
  }

  function offer(): void {
    const amount = Number(amountText);
    void respond(stage === "salary" ? { amount, years: Number(yearsText) } : { amount });
  }
</script>

<Dialog title="VERHANDLUNG: {playerName(p)}" {onClose}>
  <p>
    {POSITION_LABEL[p.position]} · {p.age} Jahre · Stärke {Math.round(p.strength)}
    {#if p.contract} · Vertrag bis Saison {p.contract.endsSeason}, {formatEuro(p.contract.salary)} pro Spieltag{/if}
  </p>
  {#if mode === "transfer" && p.clubId !== null && !isTransferWindow(gs)}<p class="warn">Das Transferfenster ist geschlossen.</p>{/if}
  {#if n}
    <p class="note">{n.note}</p>
    <p>Runde {n.round} von 3 · Forderung: {formatEuro(n.ask)}{n.stage === "salary" ? " pro Spieltag" : ""}</p>
  {/if}
  {#if !n || n.status === "open"}
    <div class="row">
      <label>
        {stage === "fee" ? "Ablöse" : "Gehalt pro Spieltag"}
        <input aria-label={stage === "fee" ? "Ablöse" : "Gehalt"} bind:value={amountText} inputmode="numeric" size="9" />
      </label>
      {#if stage === "salary"}
        <label>Jahre <input aria-label="Laufzeit" bind:value={yearsText} inputmode="numeric" size="2" /></label>
      {/if}
    </div>
    <div class="row">
      {#if n}
        <button class="btn primary" onclick={offer}>Bieten</button>
        <button class="btn" onclick={() => void respond("accept")}>Forderung annehmen</button>
        <button class="btn" onclick={() => void respond("abort")}>Abbrechen</button>
      {:else}
        <button class="btn primary" onclick={() => void begin()}>Verhandlung beginnen</button>
      {/if}
    </div>
  {:else}
    <p class="done">{n.status === "accepted" ? "Abgeschlossen." : "Beendet."}</p>
  {/if}
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</Dialog>

<style>
  p { margin: 0; font-size: 15px; }
  .note { color: var(--gold); }
  .warn { color: var(--rust); }
  .done { color: var(--leaf); }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  input { font-family: var(--font-body); font-size: 16px; color: var(--cream); background: var(--wood-dark); border: 2px solid var(--wood-edge); }
</style>
