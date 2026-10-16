<script lang="ts">
	import { NoToneMapping } from 'three';
	import { Canvas } from '@threlte/core';
	import { resolve } from '$app/paths';
	import ShelfScene from '#lib/components/ShelfScene.svelte';
	import { MIN_SEAL, earningJars, game, owner, shelfSlots } from '#lib/game.svelte.ts';
	import { SHELF } from '#lib/sealedJar.ts';

	const earning = $derived(new Set(earningJars()));
	// newest first
	const jars = $derived(
		game.shelf.map((jar, i) => ({ jar, number: i + 1, earning: earning.has(jar) })).reverse()
	);

	let width = $state(0);
	const columns = $derived(width < 520 ? 2 : width < 820 ? 3 : 4);
	const rows = $derived(Math.max(1, Math.ceil(jars.length / columns)));
	/** Room for the labels under each plank, in pixels. */
	const LABEL_PX = 64;
	// the scene is as wide as the page, so this is how much of it fits in a pixel
	const unitsPerPixel = $derived((columns * SHELF.SPACING + 1) / Math.max(width, 1));
	const rowHeight = $derived(SHELF.ROW_HEIGHT + LABEL_PX * unitsPerPixel * 0.6);
	const height = $derived(Math.max(320, (rows * rowHeight + 1) / unitsPerPixel));
</script>

<svelte:head>
	<title>Shelf · Paper Stars</title>
</svelte:head>

<main>
	<h1>{owner()} shelf</h1>
	<p class="lead">
		Every sealed jar lives here. The {shelfSlots()} richest, the sparkling ones, give back their luck
		every ten minutes for as long as the game is open; a Bigger shelf in the shop makes room for more.
		Drag to look around.
	</p>

	{#if jars.length}
		<div class="view" bind:clientWidth={width} style:height="{height}px">
			<Canvas toneMapping={NoToneMapping}>
				<ShelfScene {jars} {columns} {rowHeight} owner={owner()} />
			</Canvas>
		</div>
	{:else}
		<p class="panel empty">
			The shelf is empty. Fill a jar with at least {MIN_SEAL} stars on the
			<a href={resolve('/')}>folding table</a> and seal it.
		</p>
	{/if}
</main>

<style>
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
	}

	.lead {
		margin: 0.4rem 0 1rem;
		color: var(--muted);
		max-width: 62ch;
	}

	.view {
		cursor: grab;
	}

	.view:active {
		cursor: grabbing;
	}

	.empty {
		color: var(--muted);
	}
</style>
