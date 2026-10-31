<script lang="ts">
  import type { ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import Tile from "../theme/Tile.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const tiles: { key: string; icon: string; label: string; action: (() => void) | null }[] = [
    { key: "1", icon: "11", label: "Mannschaft", action: () => controller.open("squad") },
    { key: "2", icon: "++", label: "Training", action: null },
    { key: "3", icon: "§", label: "Verträge", action: null },
    { key: "4", icon: "<>", label: "Transfers", action: null },
    { key: "5", icon: "$", label: "Finanzen", action: null },
    { key: "6", icon: "#", label: "Tabelle", action: () => controller.open("tables") },
    { key: "7", icon: "@", label: "Nachrichten", action: null },
    { key: "8", icon: ">>", label: "Weiter", action: () => void controller.endTurn(managerId) },
  ];

  function onKey(e: KeyboardEvent): void {
    const key = e.key === "Enter" ? "8" : e.key;
    const tile = tiles.find((t) => t.key === key);
    if (tile?.action) {
      e.preventDefault();
      tile.action();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="menu">
  <ClubHeader {controller} {managerId} />
  <div class="grid">
    {#each tiles as t (t.key)}
      <Tile shortcut={t.key} icon={t.icon} label={t.label} disabled={t.action === null} onclick={() => t.action?.()} />
    {/each}
  </div>
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</div>

<style>
  .menu { display: flex; flex-direction: column; height: 100%; }
  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 10px;
    padding: 12px;
  }
  .msg { margin: 0 12px 8px; }
</style>
