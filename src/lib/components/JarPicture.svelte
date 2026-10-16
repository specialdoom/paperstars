<script lang="ts">
	import { packStars } from '#lib/jar.svelte.ts';
	import type { JarShape } from '#lib/jarShapes.ts';

	// A flat drawing of a jar from the side, its stars as dots where the jar would pile them.

	let {
		shape,
		stars = 0,
		colors = []
	}: {
		shape: JarShape;
		stars?: number;
		/** Colours the dots cycle through. */
		colors?: string[];
	} = $props();

	const PAD = 0.35;
	const DOT = 0.3;

	const outline = $derived.by(() => {
		const side = shape.profile.map(([r, y]) => `${r},${-y}`);
		const other = shape.profile.map(([r, y]) => `${-r},${-y}`).reverse();
		return [...other, ...side].join(' ');
	});

	const box = $derived.by(() => {
		const width = Math.max(...shape.profile.map(([r]) => r)) + PAD;
		const top = Math.max(...shape.profile.map(([, y]) => y)) + PAD;
		const bottom = Math.min(...shape.profile.map(([, y]) => y)) - PAD;
		return `${-width} ${-top} ${2 * width} ${top - bottom}`;
	});

	const dots = $derived(
		packStars(stars, shape)
			.flatMap((placement, i) => (placement ? [{ i, position: placement.position }] : []))
			// far ones first, so nearer ones are drawn over them
			.sort((a, b) => a.position[2] - b.position[2])
	);
</script>

<svg viewBox={box} role="img" aria-label="{shape.name} with {stars} stars">
	<polygon points={outline} class="glass" />
	{#each dots as { i, position } (i)}
		<circle
			cx={position[0]}
			cy={-position[1]}
			r={DOT}
			fill={colors.length ? colors[i % colors.length] : '#ff8fab'}
		/>
	{/each}
	<polyline points={outline} class="rim" />
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.glass {
		fill: rgba(230, 241, 255, 0.55);
	}

	.rim {
		fill: none;
		stroke: rgba(59, 51, 82, 0.45);
		stroke-width: 0.07;
		stroke-linejoin: round;
	}

	circle {
		stroke: rgba(59, 51, 82, 0.25);
		stroke-width: 0.03;
	}
</style>
