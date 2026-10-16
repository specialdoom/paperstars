<script lang="ts">
	import { backOut, cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { NoToneMapping } from 'three';
	import { Canvas } from '@threlte/core';
	import JarScene from '#lib/components/JarScene.svelte';
	import StarScene from '#lib/components/StarScene.svelte';
	import StripPreview from '#lib/components/StripPreview.svelte';
	import { FOLDS } from '#lib/foldChain.ts';
	import {
		MAX_STARS,
		addStar,
		chooseJar,
		emptyJar,
		jar,
		jarShape,
		loseStars
	} from '#lib/jar.svelte.ts';
	import { resolve } from '$app/paths';
	import {
		MIN_SEAL,
		PATTERN_COST,
		SHAPE_COST,
		earnStar,
		factoryRestMs,
		game,
		handBonus,
		seal,
		starWorth,
		wishesFor
	} from '#lib/game.svelte.ts';
	import { JAR_SHAPES } from '#lib/jarShapes.ts';
	import { PATTERNS, randomDesign, type StarDesign } from '#lib/strip.ts';

	// the first few wraps stand in for the knot: flattened, a knot is the same pentagon
	const KNOT_FOLDS = 3;
	const MS_PER_FOLD = 300;
	/** How long a finished star is shown before the factory drops it in the jar. */
	const ADMIRE_MS = 700;

	// `folds`/`tuck`/`puff` are where the animation rests once each step is done
	const STEPS = [
		{
			title: 'Cut the paper',
			text: 'Start with a narrow strip, about 1 cm wide and 25 to 30 cm long. Pick its colours and pattern.',
			folds: 0,
			tuck: 0,
			puff: 0
		},
		{
			title: 'Tie a knot',
			text: 'Make a loop with one end and tie a simple knot. Pressed flat, it becomes a pentagon.',
			folds: KNOT_FOLDS,
			tuck: 0,
			puff: 0
		},
		{
			title: 'Tuck the tail',
			text: 'Fold the short leftover tail in against the pentagon.',
			folds: KNOT_FOLDS,
			tuck: 1,
			puff: 0
		},
		{
			title: 'Wrap the strip',
			text: 'Wrap the long end around the pentagon again and again, following its sides.',
			folds: FOLDS,
			tuck: 1,
			puff: 0
		},
		{
			title: 'Tuck and puff',
			text: 'Tuck the last bit into the pocket, then gently pinch in the sides to puff it into a star.',
			folds: FOLDS,
			tuck: 1,
			puff: 1
		}
	];
	const LAST = STEPS.length - 1;

	const HINTS = {
		fold: 'Click to fold once, hold to keep folding, or drag the loose end of the strip across the crease.',
		tuck: 'Click, or drag the short tail in over the pentagon.',
		puff: 'Click to push a side in, or press on a side and drag towards the middle.'
	};

	let design = $state<StarDesign>({
		colorA: '#ff8fab',
		colorB: '#fff3c4',
		pattern: 'stripes',
		scale: 3
	});

	let step = $state(0);
	let moving = $state(false);
	/** Manual mode: the user folds each step by clicking or dragging the paper instead of watching it happen. */
	let manual = $state(true);
	/** Whether any step of the star on the table was folded for the user, which costs it the hand-folding bonus. */
	let helped = $state(false);
	const worth = $derived(starWorth(!helped));
	/** Factory mode: stars are folded and dropped in the jar one after another, until it overflows. */
	let factory = $state(false);
	const folds = new Tween(0, { easing: cubicInOut });
	const tuck = new Tween(0, { duration: 600, easing: cubicInOut });
	/** One value per pentagon side, so in manual mode each side is pushed in on its own. */
	const puff = new Tween(sides(0), { duration: 900, easing: backOut });

	function sides(value: number) {
		return Array.from({ length: 5 }, () => value);
	}

	const shape = $derived(jarShape());
	const full = $derived(jar.stars.length >= MAX_STARS);
	const sizable = $derived(design.pattern !== 'solid' && design.pattern !== 'gradient');

	/** The move that takes the paper to the next step. */
	const move = $derived.by(() => {
		if (step === LAST) return null;
		if (STEPS[step + 1].folds > STEPS[step].folds) return 'fold';
		return STEPS[step + 1].tuck > STEPS[step].tuck ? 'tuck' : 'puff';
	});
	/** In manual mode, the move the user can make right now by dragging. */
	const action = $derived(manual && !moving ? (move ?? 'carry') : null);
	const busy = $derived(moving || factory);

	/** Where the pointer is while the finished star is being carried to the jar. */
	let carried = $state<{ x: number; y: number } | null>(null);
	let jarPanel: HTMLElement;
	const overJar = $derived.by(() => {
		if (!carried) return false;
		const { left, right, top, bottom } = jarPanel.getBoundingClientRect();
		return carried.x >= left && carried.x <= right && carried.y >= top && carried.y <= bottom;
	});

	async function goTo(next: number, instant = false) {
		const target = STEPS[next];
		const duration = (ms: number) => ({ duration: instant ? 0 : ms });
		if (next === 0) helped = false;
		else if (next > step) helped = true;
		step = next;
		moving = true;
		await Promise.all([
			folds.set(target.folds, duration(Math.abs(target.folds - folds.current) * MS_PER_FOLD)),
			tuck.set(target.tuck, duration(600)),
			puff.set(sides(target.puff), duration(next === LAST ? 900 : 0))
		]);
		moving = false;
	}

	function drag(value: number, side: number) {
		const instant = { duration: 0 };
		if (action === 'fold') folds.set(value, instant);
		else if (action === 'tuck') tuck.set(value, instant);
		else if (action === 'puff') puff.set(puff.current.with(side, value), instant);
	}

	function carry(x: number, y: number, dropped: boolean) {
		carried = { x, y };
		// let go anywhere else and the star simply stays on the table
		if (dropped && overJar && !full) dropInJar();
		if (dropped) carried = null;
	}

	async function release() {
		if (!action || action === 'carry') return;
		// let go past halfway and the paper falls into place, otherwise it springs back
		const settle = { duration: 250, easing: cubicInOut };
		const held = action;
		moving = true;
		if (held === 'fold') await folds.set(Math.round(folds.current), settle);
		else if (held === 'tuck') await tuck.set(Math.round(tuck.current), settle);
		else await puff.set(puff.current.map(Math.round), settle);
		moving = false;
		arrive();
	}

	/** A plain click on the paper: one fold, the tuck, one side pushed in, or the star into the jar. */
	async function advance() {
		if (!action) return;
		if (action === 'carry') {
			if (!full) await dropInJar();
			return;
		}
		const settle = { duration: 140, easing: cubicInOut };
		const held = action;
		moving = true;
		if (held === 'fold') await folds.set(Math.floor(folds.current) + 1, settle);
		else if (held === 'tuck') await tuck.set(1, settle);
		else {
			const side = puff.current.findIndex((value) => value < 1);
			await puff.set(puff.current.with(side, 1), settle);
		}
		moving = false;
		arrive();
	}

	let holding = false;

	/** Holding the button down folds on and on, until it is let go or the star is finished. */
	async function hold(on: boolean) {
		const started = !holding && on;
		holding = on;
		if (!started) return;
		while (holding && action && action !== 'carry') await advance();
	}

	/** Moves on to the next step once the paper has got to where that step starts. */
	function arrive() {
		const next = STEPS[step + 1];
		if (
			folds.current === next.folds &&
			tuck.current === next.tuck &&
			puff.current.every((value) => value === next.puff)
		) {
			step += 1;
		}
	}

	async function dropInJar() {
		if (!addStar($state.snapshot(design), worth)) return;
		earnStar(worth, !helped);
		await goTo(0, true);
	}

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	let running = false;

	async function runFactory() {
		// switched off and on again mid-star: the loop already running just carries on
		if (running) return;
		running = true;
		manual = false;
		// the first star is the one on the table, wherever its folding has got to
		while (factory && !full) {
			if (step < LAST) {
				await goTo(step + 1);
				continue;
			}
			await sleep(ADMIRE_MS);
			if (!factory) break;
			await dropInJar();
			// the auto-folder takes a breather between stars, shorter with every gear bought
			await sleep(factoryRestMs());
		}
		factory = false;
		running = false;
	}

	function spill(indices: number[]) {
		loseStars(indices);
		// the jar is full: no point folding more stars for it
		factory = false;
	}

	function clearJar() {
		if (confirm('Empty the jar? This removes all your stars.')) emptyJar();
	}

	const jarLuck = $derived(jar.stars.reduce((sum, star) => sum + star.worth, 0));

	function sealJar() {
		const wishes = wishesFor(jarLuck);
		const question = `Seal this jar and put it on the shelf? It holds ${jarLuck} luck and grants ${wishes} ${
			wishes === 1 ? 'wish' : 'wishes'
		}. You start again with an empty jar.`;
		if (!confirm(question)) return;
		factory = false;
		seal(jar.shape, $state.snapshot(jar.stars));
		emptyJar();
	}
</script>

<svelte:head>
	<title>Paper Stars</title>
</svelte:head>

<h1 class="visually-hidden">Fold a lucky star</h1>

<main>
	<section class="panel controls">
		<h2>Your strip</h2>

		<div class="colors">
			<label>
				<input type="color" bind:value={design.colorA} />
				Paper
			</label>
			<label>
				<input type="color" bind:value={design.colorB} />
				Print
			</label>
		</div>

		<div class="patterns" role="group" aria-label="Pattern">
			{#each PATTERNS as pattern (pattern)}
				{@const locked = !game.patterns.includes(pattern)}
				<button
					type="button"
					class:selected={design.pattern === pattern}
					aria-pressed={design.pattern === pattern}
					disabled={locked}
					title={locked ? `Unlock in the shop for ${PATTERN_COST[pattern]} wishes` : undefined}
					onclick={() => (design.pattern = pattern)}
				>
					{#if locked}<span aria-label="locked">🔒</span>{/if}
					{pattern}
				</button>
			{/each}
		</div>

		<label class="size">
			Pattern size
			<input type="range" min="1" max="5" step="1" bind:value={design.scale} disabled={!sizable} />
		</label>

		<StripPreview {design} />

		<div class="actions">
			<button type="button" onclick={() => (design = randomDesign(game.patterns))}>Surprise me</button>
		</div>
	</section>

	<section class="fold">
		<div class="stage" class:carrying={carried}>
			<Canvas toneMapping={NoToneMapping}>
				<StarScene
					{design}
					folds={folds.current}
					tuck={tuck.current}
					puff={puff.current}
					finished={step === LAST || puff.current.some((value) => value > 0)}
					spin={step === LAST}
					manual={action}
					ondrag={drag}
					onrelease={release}
					oncarry={carry}
					onstep={advance}
					onhold={hold}
				/>
			</Canvas>
			<dl class="keys">
				<div>
					<dt>Left click</dt>
					<dd>fold once, drop the finished star in the jar{manual ? '' : ' (with Fold it myself on)'}</dd>
				</div>
				<div>
					<dt>Left hold</dt>
					<dd>keep folding until you let go</dd>
				</div>
				<div>
					<dt>Left drag</dt>
					<dd>fold the paper, carry the finished star to the jar</dd>
				</div>
				<div><dt>Right drag</dt><dd>rotate the view</dd></div>
				<div><dt>Scroll</dt><dd>zoom</dd></div>
				<div><dt>Touch</dt><dd>drag the paper to fold, drag beside it to rotate, pinch to zoom</dd></div>
			</dl>
		</div>

		<div class="panel guide">
			<ol class="dots" aria-hidden="true">
				{#each STEPS as { title }, i (title)}
					<li class:done={i < step} class:current={i === step}></li>
				{/each}
			</ol>
			<div class="step" aria-live="polite">
				<h2>{step + 1}. {STEPS[step].title}</h2>
				<p>{STEPS[step].text}</p>
				{#if manual && step === LAST}
					<p class="turn">
						<strong>Your turn: fill the jar.</strong>
						{full ? 'The jar is full.' : 'Click the star, or drag it over to the jar and let go.'}
					</p>
				{:else if manual && move}
					<p class="turn">
						<strong>Your turn: {STEPS[step + 1].title.toLowerCase()}.</strong>
						{HINTS[move]}
						{#if move === 'fold'}
							({Math.floor(folds.current) - STEPS[step].folds} of
							{STEPS[step + 1].folds - STEPS[step].folds} folds)
						{:else if move === 'puff'}
							({puff.current.filter((value) => value === 1).length} of 5 sides)
						{/if}
					</p>
				{/if}
			</div>
			<p class="worth">
				This star is worth <strong>{worth} luck</strong>
				{helped
					? `: fold every step yourself for ${handBonus()} times as much.`
					: `: ${handBonus()} times as much for folding it all by hand.`}
			</p>
			<div class="actions">
				<button type="button" onclick={() => goTo(step - 1)} disabled={step === 0 || busy}>
					Back
				</button>
				{#if step < LAST}
					{#if !manual}
						<button type="button" class="primary" onclick={() => goTo(step + 1)} disabled={busy}>
							Next: {STEPS[step + 1].title.toLowerCase()}
						</button>
					{/if}
				{:else}
					<button type="button" class="primary" onclick={dropInJar} disabled={busy || full}>
						{full ? 'Jar is full' : 'Drop in jar'}
					</button>
				{/if}
				<div class="modes">
					<label>
						<input type="checkbox" bind:checked={manual} disabled={busy} />
						Fold it myself
					</label>
					<label>
						<input
							type="checkbox"
							bind:checked={factory}
							onchange={() => factory && runFactory()}
							disabled={full || (moving && !factory)}
						/>
						Keep making stars
					</label>
				</div>
			</div>
		</div>
	</section>

	<section class="panel jar" class:target={overJar && !full} bind:this={jarPanel}>
		<div class="jar-head">
			<h2>Your jar</h2>
			<span>{jar.stars.length} {jar.stars.length === 1 ? 'star' : 'stars'}</span>
		</div>
		<div class="patterns" role="group" aria-label="Jar shape">
			{#each JAR_SHAPES as option (option.id)}
				{@const locked = !game.shapes.includes(option.id)}
				<button
					type="button"
					class:selected={option === shape}
					aria-pressed={option === shape}
					disabled={locked}
					title={locked ? `Unlock in the shop for ${SHAPE_COST[option.id]} wishes` : undefined}
					onclick={() => chooseJar(option)}
				>
					{#if locked}<span aria-label="locked">🔒</span>{/if}
					{option.name}
				</button>
			{/each}
		</div>
		<div class="jar-view">
			<Canvas toneMapping={NoToneMapping}>
				<JarScene stars={jar.stars} {shape} onspill={spill} />
			</Canvas>
		</div>
		<p class="hint">
			Drag the jar to tip it and shake the stars around. Stars that spill over the rim or pour out
			of a tipped jar are lost.
		</p>
		<div class="actions">
			<button
				type="button"
				class="primary"
				onclick={sealJar}
				disabled={jar.stars.length < MIN_SEAL || busy}
				title={jar.stars.length < MIN_SEAL ? `A jar needs ${MIN_SEAL} stars to be sealed` : undefined}
			>
				Seal jar · {wishesFor(jarLuck)} {wishesFor(jarLuck) === 1 ? 'wish' : 'wishes'}
			</button>
			<button type="button" onclick={clearJar} disabled={jar.stars.length === 0}>Empty jar</button>
		</div>
		<p class="hint">
			Sealed jars go on the <a href={resolve('/shelf')}>shelf</a>, where they keep giving luck. Spend
			luck and wishes in the <a href={resolve('/shop')}>shop</a>.
		</p>
	</section>
</main>

{#if carried}
	<div class="carried" style:left="{carried.x}px" style:top="{carried.y}px">
		<div style:background="linear-gradient(135deg, {design.colorA}, {design.colorB})"></div>
	</div>
{/if}

<style>
	.worth {
		margin: 0.75rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.worth strong {
		color: var(--ink);
	}

	main {
		display: grid;
		grid-template-columns: minmax(260px, 340px) minmax(0, 1fr) minmax(260px, 360px);
		gap: 1rem;
		padding: 1rem 1.5rem 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
		align-items: start;
	}

	h2 {
		margin: 0 0 0.9rem;
		font-size: 1.05rem;
	}

	.colors {
		display: flex;
		gap: 1.25rem;
		margin-bottom: 1rem;
	}

	.colors label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	input[type='color'] {
		width: 2.4rem;
		height: 2.4rem;
		padding: 0;
		border: 2px solid white;
		border-radius: 50%;
		background: none;
		cursor: pointer;
		overflow: hidden;
		box-shadow: 0 0 10px rgba(255, 138, 216, 0.5);
	}

	input[type='color']::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	input[type='color']::-webkit-color-swatch {
		border: none;
	}

	.patterns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	.patterns button {
		text-transform: capitalize;
	}

	.size {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.size input {
		accent-color: var(--accent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.fold {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.stage {
		position: relative;
		height: min(58vh, 520px);
		min-height: 300px;
	}

	/* the star has been picked up: only a faint outline stays on the table */
	.stage.carrying :global(canvas) {
		opacity: 0.25;
	}

	.carried {
		position: fixed;
		z-index: 10;
		width: 4.5rem;
		height: 4.5rem;
		margin: -2.25rem 0 0 -2.25rem;
		filter: drop-shadow(0 0 12px rgba(255, 215, 122, 0.8));
		pointer-events: none;
	}

	.carried div {
		width: 100%;
		height: 100%;
		clip-path: polygon(
			50% 0%,
			63% 35%,
			100% 38%,
			71% 61%,
			81% 97%,
			50% 76%,
			19% 97%,
			29% 61%,
			0% 38%,
			37% 35%
		);
	}

	.jar.target {
		outline: 3px solid var(--accent);
		box-shadow: 0 0 30px rgba(255, 138, 216, 0.6);
	}

	.keys {
		position: absolute;
		left: 0.5rem;
		bottom: 0.5rem;
		max-width: calc(100% - 1rem);
		margin: 0;
		padding: 0.45rem 0.65rem;
		border-radius: 10px;
		background: var(--panel);
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--muted);
		/* a legend only: drags pass through to the paper underneath */
		pointer-events: none;
	}

	.keys div {
		display: flex;
		gap: 0.5rem;
	}

	.keys dt {
		flex: none;
		min-width: 5.2em;
		font-weight: 600;
		color: var(--ink);
	}

	.keys dd {
		margin: 0;
	}

	.dots {
		display: flex;
		gap: 0.4rem;
		margin: 0 0 0.9rem;
		padding: 0;
		list-style: none;
	}

	.dots li {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--line);
	}

	.dots li.done {
		background: var(--accent-2);
	}

	.dots li.current {
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
	}

	.step h2 {
		margin-bottom: 0.35rem;
	}

	.step p {
		margin: 0;
		min-height: 2.8em;
		color: var(--muted);
		line-height: 1.4;
	}

	.step p.turn {
		margin-top: 0.5rem;
		color: var(--ink);
	}

	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin-left: auto;
		font-size: 0.9rem;
	}

	.modes label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.modes input {
		accent-color: var(--accent);
	}

	.jar-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.jar-head span {
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.jar-view {
		height: 420px;
		cursor: grab;
		/* dragging tips the jar, so it must not scroll the page on touch screens */
		touch-action: none;
	}

	.hint {
		margin: 0.25rem 0 0.75rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.hint a {
		color: var(--ink);
	}

	.jar .actions {
		margin-top: 0;
	}

	@media (max-width: 980px) {
		main {
			grid-template-columns: 1fr;
		}

		.fold {
			order: -1;
		}

		.stage {
			height: 340px;
		}
	}
</style>
