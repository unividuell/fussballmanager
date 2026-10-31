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
    gap: 6px;
    background: var(--wood);
    border: 3px solid var(--wood-edge);
    box-shadow: inset 0 0 0 2px var(--wood-dark);
    color: var(--cream);
    font-family: var(--font-body);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
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
    font-size: 16px;
    color: var(--gold);
  }
  .key {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: 14px;
    color: var(--leaf);
  }
  .soon {
    position: absolute;
    bottom: 3px;
    right: 5px;
    font-size: 13px;
    color: var(--leaf);
  }
</style>
