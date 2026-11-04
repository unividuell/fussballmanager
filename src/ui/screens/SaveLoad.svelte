<script lang="ts">
  import { onMount } from "svelte";
  import type { ManagerId } from "../../engine/model";
  import type { ManualSlot, SlotId, SlotInfo } from "../../storage/store";
  import type { GameController } from "../controller.svelte";
  import { formatSavedAt, slotName } from "../logic/saves";
  import Dialog from "../theme/Dialog.svelte";
  import Panel from "../theme/Panel.svelte";

  let { controller, managerId, onBack }: { controller: GameController; managerId: ManagerId | null; onBack: () => void } = $props();

  const inGame = $derived(managerId !== null);
  const autoUsable = $derived(controller.slots.some((s) => s.slot === "auto" && s.meta !== null));
  let confirm = $state<{ text: string; action: () => Promise<unknown> } | null>(null);
  /** true, nachdem Laden oder Import gescheitert ist – dann wird der Autosave angeboten. */
  let failed = $state(false);

  onMount(() => {
    void controller.refreshSlots();
  });

  async function load(slot: SlotId): Promise<void> {
    failed = !(await controller.loadFrom(slot)) && slot !== "auto";
  }

  const LOSS = "Nicht gespeicherter Fortschritt geht verloren.";

  function askLoad(slot: SlotId): void {
    if (inGame) confirm = { text: `${slotName(slot)} laden? ${LOSS}`, action: () => load(slot) };
    else void load(slot);
  }

  function askSave(slot: ManualSlot, info: SlotInfo): void {
    if (info.meta || info.damaged) confirm = { text: `${slotName(slot)} überschreiben?`, action: () => controller.saveTo(slot) };
    else void controller.saveTo(slot);
  }

  async function runConfirm(): Promise<void> {
    const c = confirm;
    confirm = null;
    await c?.action();
  }

  async function importFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      controller.message = "Die Datei konnte nicht gelesen werden.";
      failed = true;
      return;
    }
    if (inGame) confirm = { text: `Datei laden? ${LOSS}`, action: async () => void (failed = !controller.importText(text)) };
    else failed = !controller.importText(text);
  }

  function exportGame(): void {
    const f = controller.exportFile();
    if (!f) return;
    const url = URL.createObjectURL(new Blob([f.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (confirm) confirm = null;
      else onBack();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="saveload">
  <Panel title={inGame ? "SPEICHERN & LADEN" : "SPIEL LADEN"}>
    {#if !controller.hasStore}
      <p>Speichern ist in diesem Browser nicht möglich. Import und Export gehen trotzdem.</p>
    {:else}
      <table>
        <tbody>
          {#each controller.slots as info (info.slot)}
            <tr>
              <td class="name">{slotName(info.slot)}</td>
              <td class="meta">
                {#if info.meta}{info.meta.managers.join(", ")} · Saison {info.meta.season} · {info.meta.label}{:else if info.damaged}beschädigt{:else}– leer –{/if}
              </td>
              <td class="date">{info.meta ? formatSavedAt(info.meta.savedAt) : ""}</td>
              <td class="actions">
                <button class="btn" aria-label="{slotName(info.slot)} laden" disabled={!info.meta} onclick={() => askLoad(info.slot)}>Laden</button>
                {#if inGame && info.slot !== "auto"}
                  {@const slot = info.slot}
                  <button class="btn" aria-label="In {slotName(slot)} speichern" onclick={() => askSave(slot, info)}>Speichern</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </Panel>
  <div class="foot">
    <label class="btn file">Datei importieren<input type="file" accept=".json,application/json" onchange={(e) => void importFile(e)} /></label>
    {#if inGame}<button class="btn" onclick={exportGame}>Exportieren</button>{/if}
    {#if failed && autoUsable}<button class="btn" onclick={() => askLoad("auto")}>Autosave laden</button>{/if}
    {#if controller.message}<span class="msg">{controller.message}</span>{/if}
    <span class="spacer"></span>
    <button class="btn" onclick={onBack}>Zurück (Esc)</button>
  </div>
</div>

{#if confirm}
  <Dialog title="BESTÄTIGEN" onClose={() => (confirm = null)}>
    <p>{confirm.text}</p>
    <div class="row">
      <button class="btn primary" onclick={() => void runConfirm()}>Ja</button>
      <button class="btn" onclick={() => (confirm = null)}>Nein</button>
    </div>
  </Dialog>
{/if}

<style>
  .saveload { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 12px; box-sizing: border-box; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 4px; font-size: 17px; }
  .name { color: var(--gold); width: 80px; }
  .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
  .date { color: var(--leaf); white-space: nowrap; }
  .actions { text-align: right; white-space: nowrap; }
  .foot { display: flex; align-items: center; gap: 6px; margin-top: auto; }
  .file input { display: none; }
  .spacer { flex: 1; }
  .row { display: flex; gap: 8px; justify-content: flex-end; }
  p { margin: 0 0 8px; }
</style>
