<script lang="ts">
  import type { CompetitionId, GameState, MatchId, Score } from "../../engine/model";
  import { liveTableView } from "../logic/tables";

  let { state, competitionId, scores }: { state: GameState; competitionId: CompetitionId; scores: Record<MatchId, Score> } = $props();

  const rows = $derived(liveTableView(state, competitionId, scores));
</script>

<div class="live-table">
  <div class="title">TABELLE LIVE · {state.competitions[competitionId]?.name ?? competitionId}</div>
  <table>
    <thead><tr><th>Pl</th><th class="club">Verein</th><th>Sp</th><th>Tore</th><th>Pkt</th></tr></thead>
    <tbody>
      {#each rows as r (r.club)}
        <tr class:managed={r.manager !== null}>
          <td>{r.rank}</td>
          <td class="club">{r.name}</td>
          <td>{r.played}</td>
          <td>{r.goalsFor}:{r.goalsAgainst}</td>
          <td>{r.points}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .live-table { height: 100%; box-sizing: border-box; padding: 8px 12px; background: var(--wood); border: 4px solid var(--wood-edge); overflow: hidden; }
  .title { font-family: var(--font-display); font-size: 16px; color: var(--gold); margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 20px; line-height: 18px; }
  th { color: var(--leaf); font-weight: normal; text-align: right; }
  td { text-align: right; padding: 0 4px; }
  .club { text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
  tr.managed td { color: var(--gold); }
</style>
