<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { DoubleSide, Euler, Quaternion, Vector2, type Group, type Mesh } from 'three';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { packStars } from '#lib/jar.svelte.ts';
	import type { JarShape } from '#lib/jarShapes.ts';
	import { JAR_CENTER, createJarPhysics, type JarPhysics } from '#lib/jarPhysics.ts';
	import { createStarGeometry } from '#lib/starGeometry.ts';
	import type { StarDesign } from '#lib/strip.ts';
	import JarStar from './JarStar.svelte';

	let {
		stars,
		shape,
		onspill
	}: {
		stars: StarDesign[];
		shape: JarShape;
		/** Stars fell out of a full jar; see `loseStars` for what the numbers mean. */
		onspill?: (indices: number[]) => void;
	} = $props();

	const { invalidate, renderer } = useThrelte();

	const RADIANS_PER_PIXEL = 0.01;
	const MAX_TILT = 2.6;
	/** How quickly the jar follows the pointer, and how quickly it rights itself when let go. */
	const FOLLOW_RATE = 14;
	const RETURN_RATE = 4;

	const geometry = createStarGeometry();
	const meshes = new Map<StarDesign, Mesh>();
	let jarGroup = $state<Group>();
	let physics = $state.raw<JarPhysics>();
	/** The shape the physics walls were last built for. */
	let built: JarShape | undefined;
	let restored = false;

	const outline = $derived(shape.profile.map(([radius, y]) => new Vector2(radius, y)));
	const [floorRadius, floorY] = $derived(shape.profile[0]);
	const [rimRadius, rimY] = $derived(shape.profile[shape.profile.length - 1]);

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
		if (shape !== built) {
			physics.setShape(shape);
			built = shape;
			restored = false;
		}
		if (count < physics.stars.length) physics.clear();
		if (!restored) {
			// stars saved from an earlier visit, or moved over from another jar, start out resting
			// in a pile; any the pile has no room for are poured in on top
			for (const placement of packStars(count, shape)) physics.addStar(placement);
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
			jarGroup?.quaternion.copy(physics.tilt);
			const spilled = physics.takeSpilled();
			if (spilled.length) onspill?.(spilled);
			physics.stars.forEach((body, i) => {
				const mesh = meshes.get(stars[i]);
				if (!mesh) return;
				mesh.position.copy(body.translation());
				mesh.quaternion.copy(body.rotation());
				// a star still waiting its turn to be poured in is nowhere yet
				mesh.visible = body.isEnabled();
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

{#each stars as design (design)}
	<JarStar
		{design}
		{geometry}
		oncreate={(mesh) => {
			meshes.set(design, mesh);
			return () => meshes.delete(design);
		}}
	/>
{/each}

<T.Group bind:ref={jarGroup} position={JAR_CENTER.toArray()}>
	<T.Mesh renderOrder={1}>
		<T.LatheGeometry args={[outline, 48]} />
		<T.MeshStandardMaterial
			color="#cfe6ff"
			transparent
			opacity={0.22}
			roughness={0.1}
			side={DoubleSide}
			depthWrite={false}
		/>
	</T.Mesh>
	{#if floorRadius > 0}
		<T.Mesh position.y={floorY} rotation.x={-Math.PI / 2} renderOrder={1}>
			<T.CircleGeometry args={[floorRadius, 48]} />
			<T.MeshStandardMaterial
				color="#cfe6ff"
				transparent
				opacity={0.35}
				side={DoubleSide}
				depthWrite={false}
			/>
		</T.Mesh>
	{/if}
	<T.Mesh position.y={rimY} rotation.x={Math.PI / 2} renderOrder={1}>
		<T.TorusGeometry args={[rimRadius, 0.07, 12, 48]} />
		<T.MeshStandardMaterial color="#e6f1ff" transparent opacity={0.7} roughness={0.2} />
	</T.Mesh>
</T.Group>
