<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { BufferGeometry, Mesh } from 'three';
	import { T } from '@threlte/core';
	import { JAR_STAR_SCALE } from '#lib/jar.svelte.ts';
	import { makeStarTexture } from '#lib/starTexture.ts';
	import type { StarDesign } from '#lib/strip.ts';

	let {
		design,
		geometry,
		mesh = $bindable()
	}: {
		design: StarDesign;
		geometry: BufferGeometry;
		/** The star's mesh; the jar moves it to follow the physics. */
		mesh?: Mesh;
	} = $props();

	// a star in the jar never changes, so its texture is painted once
	// svelte-ignore state_referenced_locally
	const texture = makeStarTexture(design, 128);

	onDestroy(() => texture.dispose());
</script>

<!-- hidden until the jar has placed it -->
<T.Mesh bind:ref={mesh} {geometry} scale={JAR_STAR_SCALE} visible={false}>
	<T.MeshStandardMaterial map={texture} roughness={0.85} />
</T.Mesh>
