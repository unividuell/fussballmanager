<script lang="ts">
  import { formatEuro } from "../../engine/economy/util";
  import { clubOf, type ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { matchdayLabel } from "../logic/format";
  import { clubPlace } from "../logic/tables";
  import Crest from "../theme/Crest.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();
  const state = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(state, managerId));
  const place = $derived(club ? clubPlace(state, club.id) : null);
</script>

{#if club}
  <header class="clubhead">
    <Crest colors={club.colors} pattern={club.crest} size={20} />
    <strong>{club.name}</strong>
    <span>Saison {state.season} · {matchdayLabel(state)}</span>
    {#if place}<span class="place">{place.rank}. Platz · {state.competitions[place.competitionId].name}</span>{/if}
    <span class="money" class:negative={club.finance.balance < 0}>{formatEuro(club.finance.balance)}</span>
    {#if controller.autosaveFailed}<span class="negative">Autosave aus</span>{/if}
    <span class="mgr">{controller.managerName(managerId)}</span>
  </header>
{/if}

<style>
  .clubhead {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    background: var(--wood);
    border-bottom: 3px solid var(--wood-edge);
  }
  strong { font-family: var(--font-display); font-weight: normal; font-size: 8px; color: var(--gold); }
  .place { color: var(--leaf); }
  .money { color: var(--leaf); font-variant-numeric: tabular-nums; }
  .money.negative { color: var(--rust); }
  .negative { color: var(--rust); }
  .mgr { margin-left: auto; }
</style>
