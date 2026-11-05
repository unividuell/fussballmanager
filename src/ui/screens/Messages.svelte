<script lang="ts">
  import { messagesFor } from "../../engine/economy/messages";
  import type { ManagerId, Message } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { messageLabel } from "../logic/economy";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const gs = $derived(controller.snapshot!.state);
  const list = $derived(messagesFor(gs, managerId));

  function link(m: Message): { label: string; go: () => void } | null {
    switch (m.ref?.type) {
      case "transferOffer":
        return { label: "Zum Angebot", go: () => controller.openTransfers("offers") };
      case "sponsor":
        return { label: "Zu den Finanzen", go: () => controller.open("finance") };
      case "negotiation":
        return { label: "Zu den Verträgen", go: () => controller.open("contracts") };
      default:
        return null;
    }
  }

  function back(): void {
    controller.open("menu");
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      back();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="messages">
  <ClubHeader {controller} {managerId} />
  <Panel title="NACHRICHTEN" class="list">
    {#if list.length === 0}
      <p>Keine Nachrichten.</p>
    {:else}
      <ul>
        {#each list as m (m.id)}
          {@const l = link(m)}
          <li class="message">
            <span class="when">{messageLabel(m.season, m.calendarIndex)}</span>
            <span class="text">{m.text}</span>
            {#if l}<button class="btn small" onclick={l.go}>{l.label}</button>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>
  <div class="foot">
    <span class="spacer"></span>
    <button class="btn" onclick={back}>Zurück (Esc)</button>
  </div>
</div>

<style>
  .messages { display: flex; flex-direction: column; height: 100%; }
  .messages :global(.list) { flex: 1; min-height: 0; margin: 16px; overflow-y: auto; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: grid; grid-template-columns: 192px 1fr auto; gap: 12px; align-items: center; font-size: 23px; }
  .when { color: var(--leaf); }
  .small { padding: 0 8px; font-size: 21px; }
  p { margin: 0; }
  .foot { display: flex; padding: 0 16px 12px; }
  .spacer { flex: 1; }
</style>
