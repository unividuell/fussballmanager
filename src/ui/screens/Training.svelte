<script lang="ts">
  import { MAX_INDIVIDUAL } from "../../engine/economy/training";
  import { clubOf, type Intensity, type ManagerId, type PlayerId, type TrainingFocus, type TrainingPlan } from "../../engine/model";
  import type { GameController } from "../controller.svelte";
  import { potentialStars } from "../logic/economy";
  import { POSITION_LABEL, playerName } from "../logic/format";
  import Panel from "../theme/Panel.svelte";
  import ClubHeader from "./ClubHeader.svelte";

  let { controller, managerId }: { controller: GameController; managerId: ManagerId } = $props();

  const INTENSITIES: { id: Intensity; label: string; hint: string }[] = [
    { id: "light", label: "locker", hint: "wenig Fortschritt, schont die Kondition" },
    { id: "normal", label: "normal", hint: "ausgewogen" },
    { id: "hard", label: "hart", hint: "mehr Fortschritt, kostet Kondition, Verletzungsrisiko" },
  ];
  const FOCI: { id: TrainingFocus; label: string; hint: string }[] = [
    { id: "technique", label: "Technik", hint: "voller Fortschritt" },
    { id: "fitness", label: "Kondition", hint: "schnellere Erholung" },
    { id: "tactics", label: "Taktik", hint: "+3 % im nächsten Spiel" },
  ];

  const gs = $derived(controller.snapshot!.state);
  const club = $derived(clubOf(gs, managerId)!);
  const plan = $derived(club.training);
  const players = $derived(
    club.squad
      .map((id) => gs.players[id])
      .sort((a, b) => b.potential - b.strength - (a.potential - a.strength) || a.age - b.age),
  );

  function send(patch: Partial<TrainingPlan>): void {
    void controller.send({ type: "setTraining", managerId, training: { ...plan, individual: [...plan.individual], ...patch } });
  }

  function toggle(id: PlayerId): void {
    const individual = plan.individual.includes(id) ? plan.individual.filter((x) => x !== id) : [...plan.individual, id];
    send({ individual });
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

<div class="training">
  <ClubHeader {controller} {managerId} />
  <div class="body">
    <div class="side">
      <Panel title="INTENSITÄT">
        {#each INTENSITIES as i (i.id)}
          <button class="btn opt" class:selected={plan.intensity === i.id} onclick={() => send({ intensity: i.id })}>
            {i.label}<small>{i.hint}</small>
          </button>
        {/each}
      </Panel>
      <Panel title="SCHWERPUNKT">
        {#each FOCI as f (f.id)}
          <button class="btn opt" class:selected={plan.focus === f.id} onclick={() => send({ focus: f.id })}>
            {f.label}<small>{f.hint}</small>
          </button>
        {/each}
      </Panel>
      <button class="btn" onclick={() => controller.open("menu")}>Zurück (Esc)</button>
    </div>
    <Panel title="EXTRATRAINING ({plan.individual.length}/{MAX_INDIVIDUAL})">
      <div class="scroll">
        <table class="board-table">
          <thead><tr><th></th><th>Name</th><th>Pos</th><th class="num">Alter</th><th class="num">St</th><th>Pot</th></tr></thead>
          <tbody>
            {#each players as p (p.id)}
              <tr class:mine={plan.individual.includes(p.id)}>
                <td>{plan.individual.includes(p.id) ? "✓" : ""}</td>
                <td><button class="name" aria-label="{playerName(p)} {p.id}" onclick={() => toggle(p.id)}>{playerName(p)}</button></td>
                <td>{POSITION_LABEL[p.position]}</td>
                <td class="num">{p.age}</td>
                <td class="num">{Math.round(p.strength)}</td>
                <td class="stars">{potentialStars(p)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Panel>
  </div>
  {#if controller.message}<p class="msg">{controller.message}</p>{/if}
</div>

<style>
  .training { display: flex; flex-direction: column; height: 100%; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 440px 1fr; gap: 16px; padding: 16px; }
  .side { display: flex; flex-direction: column; gap: 12px; }
  .opt { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
  .opt small { font-size: 20px; color: var(--leaf); }
  .scroll { overflow-y: auto; min-height: 0; flex: 1; }
  .name { all: unset; cursor: pointer; }
  .name:focus-visible { outline: 2px solid var(--gold); }
  .stars { color: var(--gold); }
  .msg { margin: 0 16px 12px; }
</style>
