<script lang="ts">
	import JarPicture from '#lib/components/JarPicture.svelte';
	import StripPreview from '#lib/components/StripPreview.svelte';
	import {
		PATTERN_COST,
		SHAPE_COST,
		UPGRADES,
		buy,
		game,
		maxed,
		price,
		unlockPattern,
		unlockShape,
		type Currency
	} from '#lib/game.svelte.ts';
	import { JAR_SHAPES } from '#lib/jarShapes.ts';
	import { PATTERNS } from '#lib/strip.ts';

	const lockedPatterns = $derived(PATTERNS.filter((pattern) => !game.patterns.includes(pattern)));
	const lockedShapes = $derived(JAR_SHAPES.filter((shape) => !game.shapes.includes(shape.id)));

	function cost(amount: number, currency: Currency) {
		if (currency === 'luck') return `${amount.toLocaleString()} luck`;
		return `${amount} ${amount === 1 ? 'wish' : 'wishes'}`;
	}
</script>

<svelte:head>
	<title>Shop · Paper Stars</title>
</svelte:head>

<main>
	<h1>Shop</h1>
	<p class="lead">
		Luck buys upgrades that make every star worth more. Wishes, granted for sealing a jar, unlock new
		patterns and jars for good.
	</p>

	<section>
		<h2>Upgrades</h2>
		<ul class="grid">
			{#each UPGRADES as upgrade (upgrade.id)}
				{@const level = game.levels[upgrade.id]}
				{@const amount = price(upgrade)}
				<li class="panel item">
					<div class="title">
						<h3>{upgrade.name}</h3>
						<span class="level">
							level {level}{upgrade.max !== undefined ? ` of ${upgrade.max}` : ''}
						</span>
					</div>
					<p>{upgrade.text}</p>
					<button
						type="button"
						class="primary"
						onclick={() => buy(upgrade)}
						disabled={maxed(upgrade) || game[upgrade.currency] < amount}
					>
						{maxed(upgrade) ? 'All bought' : `Buy for ${cost(amount, upgrade.currency)}`}
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>Patterns</h2>
		{#if lockedPatterns.length}
			<ul class="grid">
				{#each lockedPatterns as pattern (pattern)}
					{@const amount = PATTERN_COST[pattern] ?? 0}
					<li class="panel item">
						<h3 class="pattern">{pattern}</h3>
						<StripPreview design={{ colorA: '#ff8fab', colorB: '#fff3c4', pattern, scale: 3 }} />
						<button
							type="button"
							class="primary"
							onclick={() => unlockPattern(pattern)}
							disabled={game.wishes < amount}
						>
							Unlock for {cost(amount, 'wishes')}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="done">Every pattern is unlocked.</p>
		{/if}
	</section>

	<section>
		<h2>Jars</h2>
		{#if lockedShapes.length}
			<ul class="grid">
				{#each lockedShapes as shape (shape.id)}
					{@const amount = SHAPE_COST[shape.id] ?? 0}
					<li class="panel item">
						<h3>{shape.name}</h3>
						<div class="jar"><JarPicture {shape} /></div>
						<button
							type="button"
							class="primary"
							onclick={() => unlockShape(shape.id)}
							disabled={game.wishes < amount}
						>
							Unlock for {cost(amount, 'wishes')}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="done">Every jar is unlocked.</p>
		{/if}
	</section>
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
		margin: 0.4rem 0 1.5rem;
		color: var(--muted);
		max-width: 60ch;
	}

	h2 {
		margin: 1.5rem 0 0.75rem;
		font-size: 1.1rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.item p {
		flex: 1;
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.item button {
		align-self: flex-start;
	}

	.title {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
	}

	.pattern {
		text-transform: capitalize;
	}

	.level {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.jar {
		height: 140px;
	}

	.done {
		color: var(--muted);
	}
</style>
