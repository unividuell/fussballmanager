<script lang="ts">
  import { expectationLabel } from "../../engine/economy/board";
  import { COMP, type ClubId, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import Crest from "../theme/Crest.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const m = $derived(gs.managers.find((x) => x.id === managerId)!);
  const hasClub = $derived(m.clubId !== null);
  const offers = $derived(m.jobOffers.map((id) => gs.clubs[id]).filter((c) => c && c.managerId === null));

  function leagueOf(id: ClubId): string {
    return gs.competitions[COMP.first]?.clubs.includes(id) ? COMP.first : COMP.second;
  }

  async function accept(clubId: ClubId): Promise<void> {
    if (await controller.send({ type: "acceptJobOffer", managerId, clubId })) controller.open("menu");
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter" && e.target instanceof Element && e.target.closest("button, input, select")) return;
    if (e.key === "Enter" && !hasClub) {
      e.preventDefault();
      void controller.endTurn(managerId);
    } else if (e.key === "Escape" && hasClub) {
      e.preventDefault();
      controller.open("menu");
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="jobs">
  <Panel>
    <h1>{hasClub ? "JOBANGEBOTE" : "OHNE VEREIN"}</h1>
    <p>{controller.managerName(managerId)}{hasClub ? "" : ` · Seit ${m.unemployedFor} Spieltagen ohne Verein.`}</p>
  </Panel>
  <Panel title="ANGEBOTE" class="list">
    {#if offers.length === 0}
      <p>Zurzeit keine Angebote. Spätestens nach 3 Spieltagen meldet sich ein Verein.</p>
    {:else}
      {#each offers as c (c.id)}
        {@const league = leagueOf(c.id)}
        <div class="offer">
          <Crest colors={c.colors} pattern={c.crest} size={40} />
          <strong>{c.name}</strong>
          <span>{gs.competitions[league]?.name ?? ""} · Ziel: {expectationLabel(c.board.expectation, league)}</span>
          <button class="btn primary" aria-label="{c.name} annehmen" onclick={() => void accept(c.id)}>Annehmen</button>
        </div>
      {/each}
    {/if}
  </Panel>
  <div class="foot">
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={() => controller.open("messages")}>Nachrichten</button>
    <button class="btn" onclick={() => controller.open("tables")}>Tabelle</button>
    {#if hasClub}
      <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
    {:else}
      <button class="btn primary" onclick={() => void controller.endTurn(managerId)}>Weiter (Enter)</button>
    {/if}
  </div>
</div>

<style>
  .jobs { display: flex; flex-direction: column; height: 100%; padding: 16px; box-sizing: border-box; gap: 12px; }
  .jobs :global(.list) { flex: 1; min-height: 0; overflow-y: auto; }
  p { margin: 0; }
  .offer { display: flex; align-items: center; gap: 16px; font-size: 24px; }
  .offer strong { font-weight: normal; color: var(--gold); }
  .offer .btn { margin-left: auto; }
  .foot { display: flex; align-items: center; gap: 12px; }
  .spacer { flex: 1; }
</style>
