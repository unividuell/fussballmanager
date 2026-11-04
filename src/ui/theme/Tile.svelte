<script lang="ts">
  let {
    shortcut,
    icon,
    label,
    disabled = false,
    selected = false,
    onclick,
  }: {
    shortcut: string;
    icon: string;
    label: string;
    disabled?: boolean;
    selected?: boolean;
    onclick: () => void;
  } = $props();
</script>

<button class="tile" class:selected {disabled} {onclick}>
  <span class="key">{shortcut}</span>
  <b>{icon}</b>
  <span class="label">{label}</span>
  {#if disabled}<span class="soon">folgt</span>{/if}
</button>

<style>
  .tile {
    position: relative;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;
    background: var(--wood);
    border: 6px solid var(--wood-edge);
    box-shadow: inset 0 0 0 4px var(--wood-dark);
    color: var(--cream);
    font-family: var(--font-body);
    font-size: 27px;
    cursor: pointer;
    padding: 8px;
  }
  .tile:hover:not(:disabled),
  .tile:focus-visible,
  .tile.selected {
    border-color: var(--gold);
    background: var(--wood-light);
    outline: none;
  }
  .tile:disabled { opacity: 0.5; cursor: default; }
  b {
    font-family: var(--font-display);
    font-weight: normal;
    font-size: 32px;
    color: var(--gold);
  }
  .key {
    position: absolute;
    top: 6px;
    left: 10px;
    font-size: 21px;
    color: var(--leaf);
  }
  .soon {
    position: absolute;
    bottom: 6px;
    right: 10px;
    font-size: 20px;
    color: var(--leaf);
  }
</style>
