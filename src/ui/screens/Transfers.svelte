<script lang="ts">
  import { marketValue } from "../../engine/economy/money";
  import { isTransferWindow } from "../../engine/economy/transfers";
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId, type Player, type PlayerId, type Position } from "../../engine/model";
  import type { GameController, TransferTab } from "../controller.svelte";
  import { DEFAULT_FILTER, INVALID_AMOUNT, marketRows, openOffers, parseEuro, type MarketFilter, type MarketRow, type OfferRow } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import { sortRows, toggleSort, type SortState } from "../logic/sort";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";
  import NegotiationDialog from "./NegotiationDialog.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const MARKET_LIMIT = 150;
  type Key = "name" | "pos" | "age" | "strength" | "club" | "fee" | "wage";
  const COLUMNS: { key: Key; label: string; num: boolean }[] = [
    { key: "name", label: "Name", num: false },
    { key: "pos", label: "Pos", num: false },
    { key: "age", label: "Alter", num: true },
    { key: "strength", label: "St", num: true },
    { key: "club", label: "Verein", num: false },
    { key: "fee", label: "Ablöse", num: true },
    { key: "wage", label: "Gehalt", num: true },
  ];
  const POS_ORDER: Position[] = ["GK", "DF", "MF", "FW"];
  const POSITION_FILTERS: { id: Position | "all"; label: string }[] = [
    { id: "all", label: "Alle" },
    ...POS_ORDER.map((id) => ({ id, label: POSITION_LABEL[id] })),
  ];
  const TABS: { id: TransferTab; label: string }[] = [
    { id: "market", label: "Markt" },
    { id: "mine", label: "Meine Spieler" },
    { id: "offers", label: "Angebote" },
  ];

  let filter = $state<MarketFilter>({ ...DEFAULT_FILTER });
  let maxFeeText = $state("");
  let sort = $state<SortState<Key>>({ key: "strength", dir: -1 });
  let talk = $state<{ playerId: PlayerId; mode: "contract" | "transfer" } | null>(null);
  let prices = $state<Record<string, string>>({});
  let counters = $state<Record<string, string>>({});
  let note = $state<string | null>(null);

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const windowOpen = $derived(isTransferWindow(gs));
  const maxFee = $derived(parseEuro(maxFeeText));
  const all = $derived(marketRows(gs, club.id, { ...filter, maxFee }));
  const rows = $derived(sortRows(all, sort, value).slice(0, MARKET_LIMIT));
  const mine = $derived(club.squad.map((id) => gs.players[id]).sort((a, b) => b.strength - a.strength));
  const offers = $derived(openOffers(gs, managerId));

  function value(r: MarketRow, k: Key): number | string {
    switch (k) {
      case "name":
        return r.player.lastName;
      case "pos":
        return POS_ORDER.indexOf(r.player.position);
      case "age":
        return r.player.age;
      case "strength":
        return r.player.strength;
      case "club":
        return r.clubName;
      case "fee":
        return r.fee;
      case "wage":
        return r.wage;
    }
  }

  function arrow(k: Key): string {
    return sort.key === k ? (sort.dir === -1 ? " ▼" : " ▲") : "";
  }

  function list(p: Player, listed: boolean): void {
    const text = (prices[p.id] ?? "").trim();
    const price = listed && text !== "" ? parseEuro(text) : null;
    if (listed && text !== "" && price === null) {
      note = INVALID_AMOUNT;
      return;
    }
    note = null;
    void controller.send({ type: "setTransferListing", managerId, playerId: p.id, listed, askingPrice: price });
  }

  function counter(o: OfferRow): void {
    const amount = parseEuro(counters[o.offer.id] ?? "");
    if (amount === null) {
      note = INVALID_AMOUNT;
      return;
    }
    note = null;
    void controller.send({ type: "respondTransferOffer", managerId, offerId: o.offer.id, response: { counter: amount } });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (talk) talk = null;
    else controller.open("menu");
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="transfers">
  <ClubHeader {controller} {managerId} />
  <div class="tabs">
    {#each TABS as t (t.id)}
      <button class="btn" class:selected={controller.transferTab === t.id} onclick={() => (controller.transferTab = t.id)}>
        {t.label}{t.id === "offers" ? ` (${offers.length})` : ""}
      </button>
    {/each}
    <span class="status" class:closed={!windowOpen}>{windowOpen ? "Transferfenster offen" : "Transferfenster geschlossen – nur Vereinslose verpflichtbar"}</span>
  </div>

  {#if controller.transferTab === "market"}
    <div class="filters">
      {#each POSITION_FILTERS as pf (pf.id)}
        <button class="btn" class:selected={filter.position === pf.id} onclick={() => (filter = { ...filter, position: pf.id })}>{pf.label}</button>
      {/each}
      <label><input type="checkbox" bind:checked={filter.freeOnly} /> nur Vereinslose</label>
      <label><input type="checkbox" bind:checked={filter.listedOnly} /> nur Transferliste</label>
      <label>max. <input class="money" aria-label="Höchstablöse" bind:value={maxFeeText} inputmode="numeric" size="9" /></label>
    </div>
    <p class="count">{all.length > MARKET_LIMIT ? `${MARKET_LIMIT} von ${all.length}` : `${all.length} Spieler`}</p>
    <Panel class="list">
      <div class="scroll">
        <table class="board-table">
          <thead>
            <tr>
              {#each COLUMNS as col (col.key)}
                <th class:num={col.num}>
                  <button class="sort" aria-label="Sortieren nach {col.label}" onclick={() => (sort = toggleSort(sort, col.key))}>{col.label}{arrow(col.key)}</button>
                </th>
              {/each}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.player.id)}
              <tr>
                <td>{playerName(r.player)}</td>
                <td class="pos">{POSITION_LABEL[r.player.position]}</td>
                <td class="num age">{r.player.age}</td>
                <td class="num">{Math.round(r.player.strength)}</td>
                <td class="club">{r.clubName}</td>
                <td class="num">{r.free ? "–" : formatEuro(r.fee)}</td>
                <td class="num">{formatEuro(r.wage)}</td>
                <td>
                  <button class="btn small" aria-label="{playerName(r.player)} verhandeln" onclick={() => (talk = { playerId: r.player.id, mode: r.free ? "contract" : "transfer" })}>Verhandeln</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
  {:else if controller.transferTab === "mine"}
    <Panel class="list">
      <div class="scroll">
        <table class="board-table">
          <thead><tr><th>Name</th><th class="num">St</th><th class="num">Marktwert</th><th>Status</th><th>Wunschpreis</th><th></th></tr></thead>
          <tbody>
            {#each mine as p (p.id)}
              <tr>
                <td>{playerName(p)}</td>
                <td class="num">{Math.round(p.strength)}</td>
                <td class="num">{formatEuro(marketValue(p, gs.season))}</td>
                <td>{p.transferListed ? (p.transferListed.askingPrice ? `gelistet: ${formatEuro(p.transferListed.askingPrice)}` : "gelistet") : "—"}</td>
                <td><input class="money" aria-label="Wunschpreis {playerName(p)}" bind:value={prices[p.id]} inputmode="numeric" size="9" /></td>
                <td>
                  {#if p.transferListed}
                    <button class="btn small" aria-label="{playerName(p)} von der Liste" onclick={() => list(p, false)}>Von der Liste</button>
                  {:else}
                    <button class="btn small" aria-label="{playerName(p)} auf die Liste" onclick={() => list(p, true)}>Auf die Liste</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
  {:else}
    <Panel class="list">
      {#if offers.length === 0}
        <p>Keine offenen Angebote.</p>
      {:else}
        {#each offers as o (o.offer.id)}
          <div class="offer">
            <span>{o.buyerName} bietet {formatEuro(o.offer.fee)} für {o.playerName} (Runde {o.offer.round}/3)</span>
            <button class="btn small" aria-label="Angebot für {o.playerName} annehmen" onclick={() => void controller.send({ type: "respondTransferOffer", managerId, offerId: o.offer.id, response: "accept" })}>Annehmen</button>
            <button class="btn small" aria-label="Angebot für {o.playerName} ablehnen" onclick={() => void controller.send({ type: "respondTransferOffer", managerId, offerId: o.offer.id, response: "reject" })}>Ablehnen</button>
            <input class="money" aria-label="Gegenangebot {o.playerName}" bind:value={counters[o.offer.id]} inputmode="numeric" size="9" />
            <button class="btn small" aria-label="Gegenangebot für {o.playerName} senden" onclick={() => counter(o)}>Gegenangebot</button>
          </div>
        {/each}
      {/if}
    </Panel>
  {/if}

  <div class="foot">
    {#if note}<span class="msg">{note}</span>{:else if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
  </div>
  {#if talk}
    <NegotiationDialog {controller} {managerId} playerId={talk.playerId} mode={talk.mode} onClose={() => (talk = null)} />
  {/if}
</div>

<style>
  .transfers { display: flex; flex-direction: column; height: 100%; position: relative; }
  .tabs, .filters { display: flex; align-items: center; gap: 6px; padding: 4px 8px 0; flex-wrap: wrap; font-size: 15px; }
  .status { margin-left: auto; color: var(--leaf); }
  .status.closed { color: var(--rust); }
  .transfers :global(.list) { flex: 1; min-height: 0; margin: 6px 8px; }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .board-table { font-size: 15px; }
  .sort { all: unset; cursor: pointer; color: var(--leaf); }
  .sort:focus-visible { outline: 1px solid var(--gold); }
  .small { padding: 0 4px; font-size: 14px; }
  .money { font-family: var(--font-body); font-size: 15px; color: var(--cream); background: var(--wood-dark); border: 2px solid var(--wood-edge); }
  .offer { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 15px; }
  p { margin: 0; }
  .count { padding: 2px 8px 0; font-size: 14px; color: var(--leaf); }
  .foot { display: flex; align-items: center; gap: 6px; padding: 0 8px 6px; }
  .spacer { flex: 1; }
</style>
