<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { DoubleSide, Euler, Quaternion, type Group, type Mesh } from 'three';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { JAR_HEIGHT, JAR_RADIUS, packStars } from '#lib/jar.svelte.ts';
	import { JAR_CENTER, createJarPhysics, type JarPhysics } from '#lib/jarPhysics.ts';
	import { createStarGeometry } from '#lib/starGeometry.ts';
	import type { StarDesign } from '#lib/strip.ts';
	import JarStar from './JarStar.svelte';

	let { stars }: { stars: StarDesign[] } = $props();

	const { invalidate, renderer } = useThrelte();

	const RADIANS_PER_PIXEL = 0.01;
	const MAX_TILT = 2.6;
	/** How quickly the jar follows the pointer, and how quickly it rights itself when let go. */
	const FOLLOW_RATE = 14;
	const RETURN_RATE = 4;

	const geometry = createStarGeometry();
	const meshes = $state<(Mesh | undefined)[]>([]);
	let jarGroup = $state<Group>();
	let physics = $state.raw<JarPhysics>();
	let restored = false;

	// the jar tilts forward/back (pitch) and left/right (roll) towards where it was dragged
	const tilt = { pitch: 0, roll: 0 };
	const target = { pitch: 0, roll: 0 };
	let dragging = false;
	const euler = new Euler();
	const rotation = new Quaternion();

	const clamp = (value: number) => Math.min(Math.max(value, -MAX_TILT), MAX_TILT);

	onMount(() => {
		let disposed = false;
		createJarPhysics().then((created) => {
			if (disposed) created.dispose();
			else physics = created;
		});

		const element = renderer.domElement;
		let last = { x: 0, y: 0 };
		const down = (event: PointerEvent) => {
			dragging = true;
			last = { x: event.clientX, y: event.clientY };
			element.setPointerCapture(event.pointerId);
		};
		const move = (event: PointerEvent) => {
			if (!dragging) return;
			target.roll = clamp(target.roll - (event.clientX - last.x) * RADIANS_PER_PIXEL);
			target.pitch = clamp(target.pitch + (event.clientY - last.y) * RADIANS_PER_PIXEL);
			last = { x: event.clientX, y: event.clientY };
			invalidate();
		};
		const up = () => {
			dragging = false;
			target.roll = target.pitch = 0;
			invalidate();
		};
		element.addEventListener('pointerdown', down);
		element.addEventListener('pointermove', move);
		element.addEventListener('pointerup', up);
		element.addEventListener('pointercancel', up);

		return () => {
			disposed = true;
			element.removeEventListener('pointerdown', down);
			element.removeEventListener('pointermove', move);
			element.removeEventListener('pointerup', up);
			element.removeEventListener('pointercancel', up);
			physics?.dispose();
		};
	});

	// keep one physics body per star
	$effect(() => {
		const count = stars.length;
		if (!physics) return;
		if (count < physics.stars.length) physics.clear();
		if (!restored) {
			// stars saved from an earlier visit start out resting in a pile
			for (const placement of packStars(count)) physics.addStar(placement);
			restored = true;
		}
		while (physics.stars.length < count) physics.addStar();
		invalidate();
	});

	useTask(
		(delta) => {
			if (!physics) return;
			const follow = 1 - Math.exp(-(dragging ? FOLLOW_RATE : RETURN_RATE) * delta);
			tilt.pitch += (target.pitch - tilt.pitch) * follow;
			tilt.roll += (target.roll - tilt.roll) * follow;
			rotation.setFromEuler(euler.set(tilt.pitch, 0, tilt.roll));

			const active = physics.step(delta, rotation);
			jarGroup?.quaternion.copy(rotation);
			physics.stars.forEach((body, i) => {
				const mesh = meshes[i];
				if (!mesh) return;
				mesh.position.copy(body.translation());
				mesh.quaternion.copy(body.rotation());
				mesh.visible = true;
			});
			if (active) invalidate();
		},
		{ autoInvalidate: false }
	);

	onDestroy(() => geometry.dispose());
</script>

<T.PerspectiveCamera
	makeDefault
	position={[0, 4.2, 10.5]}
	fov={40}
	oncreate={(camera) => camera.lookAt(JAR_CENTER)}
/>

<T.AmbientLight intensity={1.7} />
<T.DirectionalLight position={[4, 8, 6]} intensity={1.6} />
<T.DirectionalLight position={[-5, 2, -4]} intensity={1} />

{#each stars as design, i (i)}
	<JarStar {design} {geometry} bind:mesh={meshes[i]} />
{/each}

<T.Group bind:ref={jarGroup} position={JAR_CENTER.toArray()}>
	<T.Mesh renderOrder={1}>
		<T.CylinderGeometry args={[JAR_RADIUS, JAR_RADIUS, JAR_HEIGHT, 48, 1, true]} />
		<T.MeshStandardMaterial
			color="#cfe6ff"
			transparent
			opacity={0.22}
			roughness={0.1}
			side={DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
	<T.Mesh position.y={-JAR_HEIGHT / 2} rotation.x={-Math.PI / 2} renderOrder={1}>
		<T.CircleGeometry args={[JAR_RADIUS, 48]} />
		<T.MeshStandardMaterial
			color="#cfe6ff"
			transparent
			opacity={0.35}
			side={DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
	<T.Mesh position.y={JAR_HEIGHT / 2} rotation.x={Math.PI / 2} renderOrder={1}>
		<T.TorusGeometry args={[JAR_RADIUS, 0.07, 12, 48]} />
		<T.MeshStandardMaterial color="#e6f1ff" transparent opacity={0.7} roughness={0.2} />
	</T.Mesh>
</T.Group>
