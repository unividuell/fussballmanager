<script lang="ts">
  let {
    curve,
    minute,
    marks,
    homeColor,
    awayColor,
    homeName,
    awayName,
    chances,
  }: {
    curve: number[];
    minute: number;
    marks: { minute: number; home: boolean; goal: boolean }[];
    homeColor: string;
    awayColor: string;
    homeName: string;
    awayName: string;
    chances: [number, number];
  } = $props();

  const W = 100 / 90;
  const shown = $derived(curve.slice(0, minute));
</script>

<div class="graph">
  <div class="plot">
    <div class="half"></div>
    <div class="axis"></div>
    {#each shown as v, i (i)}
      <div
        class="col"
        style:left="{i * W}%"
        style:width="{W}%"
        style:height="{Math.abs(v) * 50}%"
        style:top={v >= 0 ? `${50 - Math.abs(v) * 50}%` : "50%"}
        style:background={v >= 0 ? homeColor : awayColor}
      ></div>
    {/each}
    {#each marks as m (`${m.minute}-${m.home}-${m.goal}`)}
      <div class="mark" class:goal={m.goal} class:away={!m.home} style:left="{(m.minute - 0.5) * W}%"></div>
    {/each}
    <div class="cursor" style:left="{minute * W}%"></div>
  </div>
  <div class="stats">
    <span>▲ {homeName}</span>
    <span>Chancen {chances[0]} : {chances[1]}</span>
    <span>{awayName} ▼</span>
  </div>
</div>

<style>
  .graph { display: flex; flex-direction: column; gap: 4px; height: 100%; }
  .plot { position: relative; flex: 1; background: var(--shade); border: 4px solid var(--wood-edge); overflow: hidden; }
  .axis { position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: var(--cream); opacity: 0.6; }
  .half { position: absolute; top: 0; bottom: 0; left: 50%; border-left: 2px dashed var(--leaf); opacity: 0.6; }
  .col { position: absolute; }
  .mark { position: absolute; top: 4px; width: 10px; height: 10px; margin-left: -6px; border-radius: 50%; background: var(--cream); border: 2px solid var(--ink); }
  .mark.away { top: auto; bottom: 4px; }
  .mark.goal { width: 14px; height: 14px; margin-left: -8px; background: var(--gold); }
  .cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--gold); }
  .stats { display: flex; justify-content: space-between; font-size: 22px; color: var(--cream); white-space: nowrap; }
</style>
