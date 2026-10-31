<script lang="ts">
  import type { CrestPattern } from "../../engine/model";

  let { colors, pattern, size = 16 }: { colors: [string, string]; pattern: CrestPattern; size?: number } = $props();
  const uid = $props.id();
  const clipId = `crest-${uid}`;
  const SHIELD = "M1 1 H15 V9 Q15 15 8 17 Q1 15 1 9 Z";
</script>

<svg width={size} height={Math.round((size * 18) / 16)} viewBox="0 0 16 18" aria-hidden="true">
  <defs>
    <clipPath id={clipId}><path d={SHIELD} /></clipPath>
  </defs>
  <g clip-path="url(#{clipId})">
    <rect x="0" y="0" width="16" height="18" fill={colors[0]} />
    {#if pattern === "stripes"}
      <g data-pattern fill={colors[1]}>
        <rect x="3" y="0" width="2" height="18" /><rect x="7" y="0" width="2" height="18" /><rect x="11" y="0" width="2" height="18" />
      </g>
    {:else if pattern === "sash"}
      <polygon data-pattern fill={colors[1]} points="0,4 4,0 16,14 16,18 12,18 0,6" />
    {:else if pattern === "split"}
      <rect data-pattern fill={colors[1]} x="8" y="0" width="8" height="18" />
    {:else if pattern === "hoops"}
      <g data-pattern fill={colors[1]}>
        <rect x="0" y="4" width="16" height="2" /><rect x="0" y="9" width="16" height="2" /><rect x="0" y="14" width="16" height="2" />
      </g>
    {/if}
  </g>
  <path d={SHIELD} fill="none" stroke="var(--cream)" stroke-width="1" />
</svg>
