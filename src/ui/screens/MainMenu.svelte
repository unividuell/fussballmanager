<script lang="ts">
  import type { ManagerId } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { messagesFor } from "../../engine/economy/messages";
  import { openOffers } from "../logic/economy";
  import Tile from "../theme/Tile.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const offerCount = $derived(openOffers(gs, managerId).length);
  const newMessages = $derived(
    messagesFor(gs, managerId).filter((m) => m.season === gs.season && m.calendarIndex >= gs.calendarIndex - 1).length,
  );
  const count = (label: string, n: number) => (n > 0 ? `${label} (${n})` : label);

  const tiles = $derived<{ key: string; icon: string; label: string; action: (() => void) | null }[]>([
    { key: "1", icon: "11", label: "Mannschaft", action: () => controller.open("squad") },
    { key: "2", icon: "++", label: "Training", action: () => controller.open("training") },
    { key: "3", icon: "§", label: "Verträge", action: () => controller.open("contracts") },
    { key: "4", icon: "<>", label: count("Transfers", offerCount), action: () => controller.openTransfers("market") },
    { key: "5", icon: "$", label: "Finanzen", action: () => controller.open("finance") },
    { key: "6", icon: "#", label: "Tabelle", action: () => controller.open("tables") },
    { key: "7", icon: "@", label: count("Nachrichten", newMessages), action: () => controller.open("messages") },
    { key: "8", icon: ">>", label: "Weiter", action: () => void controller.endTurn(managerId) },
  ]);

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter" && e.target instanceof Element && e.target.closest("button, input, select")) return;
    if (e.key.toLowerCase() === "o") {
      e.preventDefault();
      controller.open("options");
      return;
    }
    if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      controller.open("save");
      return;
    }
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
  <div class="extra">
    <button class="btn" onclick={() => controller.open("save")}>Speichern (S)</button>
    <button class="btn" onclick={() => controller.open("options")}>Optionen (O)</button>
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
    gap: 20px;
    padding: 24px;
  }
  .extra { display: flex; gap: 12px; justify-content: flex-end; padding: 0 24px 12px; }
  .msg { margin: 0 24px 16px; }
</style>
