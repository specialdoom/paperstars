<script lang="ts">
	import { onDestroy } from 'svelte';
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import type { JarShape } from '#lib/jarShapes.ts';
	import { buildSealedJar } from '#lib/sealedJar.ts';
	import { createStarGeometry } from '#lib/starGeometry.ts';

	// An empty, open jar turning slowly on its own, to show off a jar shape.

	let { shape }: { shape: JarShape } = $props();

	const FOV = 32;

	const starGeometry = createStarGeometry();
	const model = $derived(buildSealedJar(shape, 0, [], starGeometry, false, false));
	$effect(() => {
		const built = model;
		return () => built.dispose();
	});

	// frame the whole jar, whatever its shape
	const width = $derived(2 * Math.max(...shape.profile.map(([radius]) => radius)) + 0.6);
	const height = $derived(model.top - model.bottom + 0.6);
	const middle = $derived((model.top + model.bottom) / 2);
	const distance = $derived(
		Math.max(height, width) / 2 / Math.tan(((FOV / 2) * Math.PI) / 180) + 1.2
	);

	onDestroy(() => starGeometry.dispose());
</script>

<T.PerspectiveCamera makeDefault position={[0, middle + distance * 0.25, distance]} fov={FOV}>
	<OrbitControls
		target={[0, middle, 0]}
		autoRotate
		autoRotateSpeed={1.5}
		enableZoom={false}
		enablePan={false}
		enableDamping
		minPolarAngle={Math.PI / 2 - 0.6}
		maxPolarAngle={Math.PI / 2 + 0.1}
	/>
</T.PerspectiveCamera>

<T.AmbientLight intensity={1.4} />
<T.DirectionalLight position={[4, 8, 8]} intensity={1.6} />
<T.DirectionalLight position={[-6, 3, -4]} intensity={0.8} color="#ff8ad8" />
<T.DirectionalLight position={[6, -2, 4]} intensity={0.5} color="#8fe9ff" />

<T is={model.group} />
