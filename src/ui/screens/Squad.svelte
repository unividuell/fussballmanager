<script lang="ts">
  import { FORMATION_LIST, clubOf, type Hardness, type ManagerId, type PlayerId, type Style, type Tactics } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { HARDNESS_LABEL, POSITION_LABEL, STYLE_LABEL, fitnessText, formText, playerName, statusText } from "../logic/format";
  import { squadRows, swapPlayers, type SquadRow } from "../logic/lineupEdit";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const STYLES: Style[] = ["defensive", "normal", "offensive"];
  const HARDNESSES: Hardness[] = ["fair", "normal", "hard"];

  const club = $derived(clubOf(controller.snapshot!.state, managerId)!);
  const rows = $derived(squadRows(controller.snapshot!.state, club.id));
  let picked = $state<PlayerId | null>(null);

  function place(r: SquadRow): string {
    if (r.area === "starter") return r.slot ? POSITION_LABEL[r.slot] : "";
    return r.area === "bench" ? "Bank" : "";
  }

  async function pick(id: PlayerId): Promise<void> {
    if (picked === null) {
      picked = id;
      return;
    }
    const first = picked;
    picked = null;
    if (first === id) return;
    await controller.send({ type: "setLineup", managerId, lineup: swapPlayers(club.lineup, first, id) });
  }

  function setTactics(patch: Partial<Tactics>): void {
    void controller.send({ type: "setTactics", managerId, tactics: { ...club.tactics, ...patch } });
  }

  function auto(): void {
    picked = null;
    void controller.send({ type: "autoLineup", managerId });
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

<div class="squad">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <Panel title="KADER" class="list">
      <div class="scroll">
        <table class="board-table">
          <thead>
            <tr><th>Platz</th><th>Name</th><th>Pos</th><th class="num">Alter</th><th class="num">St</th><th class="num">Form</th><th class="num">Kond</th><th>Status</th></tr>
          </thead>
          <tbody>
            {#each rows as r (r.player.id)}
              <tr class:picked={picked === r.player.id} class:bench={r.area === "bench"} class:reserve={r.area === "reserve"}>
                <td>{place(r)}</td>
                <td>
                  <button class="name" aria-label="{playerName(r.player)} {r.player.id}" onclick={() => pick(r.player.id)}>
                    {playerName(r.player)}
                  </button>
                </td>
                <td>{POSITION_LABEL[r.player.position]}</td>
                <td class="num">{r.player.age}</td>
                <td class="num">{Math.round(r.player.strength)}</td>
                <td class="num">{formText(r.player.form)}</td>
                <td class="num">{fitnessText(r.player.fitness)}</td>
                <td class="status">{statusText(r.player)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
    <div class="side">
      <Panel title="FORMATION">
        <div class="opts">
          {#each FORMATION_LIST as f (f)}
            <button class="btn" class:selected={club.tactics.formation === f} onclick={() => setTactics({ formation: f })}>{f}</button>
          {/each}
        </div>
      </Panel>
      <Panel title="SPIELWEISE">
        <div class="opts">
          {#each STYLES as s (s)}
            <button class="btn" class:selected={club.tactics.style === s} onclick={() => setTactics({ style: s })}>{STYLE_LABEL[s]}</button>
          {/each}
        </div>
      </Panel>
      <Panel title="HÄRTE">
        <div class="opts">
          {#each HARDNESSES as h (h)}
            <button class="btn" class:selected={club.tactics.hardness === h} onclick={() => setTactics({ hardness: h })}>{HARDNESS_LABEL[h]}</button>
          {/each}
        </div>
      </Panel>
      <button class="btn" onclick={auto}>Automatisch</button>
      <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
    </div>
  </div>
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</div>

<style>
  .squad { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 168px; gap: 8px; padding: 8px; }
  .body :global(.list) { min-height: 0; }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .side { display: flex; flex-direction: column; gap: 6px; }
  .opts { display: flex; flex-wrap: wrap; gap: 4px; }
  .opts .btn { padding: 1px 5px; }
  .name {
    all: unset;
    cursor: pointer;
    color: inherit;
  }
  .name:focus-visible { outline: 1px solid var(--gold); }
  tr.bench td { color: var(--leaf); }
  tr.reserve td { opacity: 0.8; }
  tr.picked td { background: var(--rust); color: var(--cream); opacity: 1; }
  .status { color: var(--rust); }
  tr.picked .status { color: var(--cream); }
  .msg { margin: 0 8px 6px; }
</style>
