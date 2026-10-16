<script lang="ts">
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import { HTML, OrbitControls, RoundedBoxGeometry, Sparkles } from '@threlte/extras';
	import { jarLuckPerSecond, type SealedJar } from '#lib/game.svelte.ts';
	import { JAR_SHAPES, findShape } from '#lib/jarShapes.ts';
	import { SHELF, buildSealedJar, type SealedJarModel } from '#lib/sealedJar.ts';
	import { createStarGeometry } from '#lib/starGeometry.ts';

	let {
		jars,
		columns,
		rowHeight = SHELF.ROW_HEIGHT,
		owner
	}: {
		/** Newest first, each with its number on the shelf and whether it is giving luck. */
		jars: { jar: SealedJar; number: number; earning: boolean }[];
		columns: number;
		/** Space from one plank to the next, which leaves the labels room on a small screen. */
		rowHeight?: number;
		/** Whose jars these are, for the labels. */
		owner: string;
	} = $props();

	const { size } = useThrelte();
	const FOV = 30;
	const { SPACING, PLANK_DEPTH, PLANK_THICKNESS } = SHELF;
	/** Sparkles are drawn smaller the further away they are; this keeps them a few pixels across. */
	const SPARKLE_PIXELS = 0.9;

	const starGeometry = createStarGeometry();

	let models = $state.raw<SealedJarModel[]>([]);
	$effect(() => {
		const built = jars.map(({ jar, earning }) =>
			buildSealedJar(
				findShape(jar.shape) ?? JAR_SHAPES[0],
				jar.stars,
				jar.designs,
				starGeometry,
				earning
			)
		);
		models = built;
		return () => built.forEach((model) => model.dispose());
	});

	const rows = $derived(Math.max(1, Math.ceil(jars.length / columns)));
	const width = $derived(columns * SPACING + 1);

	/** Where jar `index` stands: left to right along each plank, top plank first. */
	function place(index: number) {
		const row = Math.floor(index / columns);
		const inRow = Math.min(columns, jars.length - row * columns);
		const x = ((index % columns) - (inRow - 1) / 2) * SPACING;
		return { x, plank: -row * rowHeight };
	}

	// frame all the planks, looking slightly down onto them
	const top = SHELF.ROW_HEIGHT - 1.2;
	const bottom = $derived(-(rows - 1) * rowHeight - 1.6);
	const middle = $derived((top + bottom) / 2);
	const distance = $derived(
		Math.max((top - bottom) / 2, width / 2 / ($size.width / Math.max($size.height, 1))) /
			Math.tan(((FOV / 2) * Math.PI) / 180) +
			2
	);

	onDestroy(() => starGeometry.dispose());
</script>

<T.PerspectiveCamera makeDefault position={[0, middle + 1.5, distance]} fov={FOV}>
	<OrbitControls
		target={[0, middle, 0]}
		enableZoom={false}
		enablePan={false}
		enableDamping
		minAzimuthAngle={-0.45}
		maxAzimuthAngle={0.45}
		minPolarAngle={Math.PI / 2 - 0.4}
		maxPolarAngle={Math.PI / 2 + 0.05}
	/>
</T.PerspectiveCamera>

<T.AmbientLight intensity={1.4} />
<T.DirectionalLight position={[4, 8, 8]} intensity={1.6} />
<T.DirectionalLight position={[-6, 3, -4]} intensity={0.8} color="#ff8ad8" />
<T.DirectionalLight position={[6, -2, 4]} intensity={0.5} color="#8fe9ff" />

{#each { length: rows } as _, row (row)}
	{@const y = -row * rowHeight}
	<!-- a lilac lacquered plank with a gold edge -->
	<T.Mesh position={[0, y - PLANK_THICKNESS / 2, 0]}>
		<RoundedBoxGeometry args={[width, PLANK_THICKNESS, PLANK_DEPTH]} radius={0.08} />
		<T.MeshStandardMaterial color="#6b4aa8" roughness={0.55} />
	</T.Mesh>
	<T.Mesh position={[0, y - PLANK_THICKNESS / 2, PLANK_DEPTH / 2 + 0.02]}>
		<T.BoxGeometry args={[width - 0.1, 0.1, 0.04]} />
		<T.MeshStandardMaterial
			color="#ffd77a"
			emissive="#ffb84d"
			emissiveIntensity={0.4}
			metalness={0.6}
			roughness={0.3}
		/>
	</T.Mesh>
{/each}

{#each models as model, index (model)}
	{@const { jar, number, earning } = jars[index]}
	{@const { x, plank } = place(index)}
	<T is={model.group} position={[x, plank - model.bottom, 0]} />
	{#if earning}
		<Sparkles
			position={[x, plank + (model.top - model.bottom) / 2, 0]}
			scale={[SPACING * 0.7, model.top - model.bottom + 0.6, PLANK_DEPTH * 0.7]}
			count={28}
			size={distance * SPARKLE_PIXELS}
			speed={0.4}
			color="#ffd77a"
		/>
	{/if}
	<HTML
		position={[x, plank - PLANK_THICKNESS - 0.15, PLANK_DEPTH / 2]}
		center
		pointerEvents="none"
		zIndexRange={[4, 0]}
	>
		<div class="tag" class:earning>
			<strong>{owner} jar #{number}</strong>
			<span>{jar.stars} stars · {Math.floor(jar.luck).toLocaleString()} luck</span>
			{#if earning}<em>+{jarLuckPerSecond(jar).toFixed(2)} luck/s</em>{/if}
		</div>
	</HTML>
{/each}

<style>
	.tag {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 1.4rem;
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--panel-edge);
		border-radius: 10px;
		background: rgba(17, 9, 48, 0.8);
		color: var(--muted);
		font-size: 0.75rem;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.tag strong {
		font-family: var(--display);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--ink);
	}

	.tag em {
		font-style: normal;
		font-weight: 700;
		color: var(--gold);
	}

	.tag.earning {
		border-color: var(--gold);
		box-shadow: 0 0 14px rgba(255, 215, 122, 0.35);
	}
</style>
