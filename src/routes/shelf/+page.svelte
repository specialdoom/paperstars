<script lang="ts">
	import { resolve } from '$app/paths';
	import JarPicture from '#lib/components/JarPicture.svelte';
	import { MIN_SEAL, earningJars, game, jarLuckPerSecond, owner, shelfSlots } from '#lib/game.svelte.ts';
	import { JAR_SHAPES, findShape } from '#lib/jarShapes.ts';

	const earning = $derived(new Set(earningJars()));
	// newest first
	const jars = $derived(game.shelf.map((jar, i) => ({ jar, number: i + 1 })).reverse());
</script>

<svelte:head>
	<title>Shelf · Paper Stars</title>
</svelte:head>

<main>
	<h1>{owner()} shelf</h1>
	<p class="lead">
		Every sealed jar lives here. The {shelfSlots()} richest give back their luck every ten minutes, for
		as long as the game is open; a Bigger shelf in the shop makes room for more.
	</p>

	{#if jars.length}
		<ul class="shelf">
			{#each jars as { jar, number } (number)}
				<li class="panel" class:earning={earning.has(jar)}>
					<div class="picture">
						<JarPicture
							shape={findShape(jar.shape) ?? JAR_SHAPES[0]}
							stars={jar.stars}
							colors={jar.colors}
						/>
					</div>
					<h2>{owner()} jar #{number}</h2>
					<p>
						{jar.stars} stars · {Math.floor(jar.luck).toLocaleString()} luck
						<br />
						<small>sealed {new Date(jar.sealedAt).toLocaleDateString()}</small>
					</p>
					{#if earning.has(jar)}
						<span class="badge">+{jarLuckPerSecond(jar).toFixed(2)} luck/s</span>
					{/if}
				</li>
			{/each}
		</ul>
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
		margin: 0.4rem 0 1.5rem;
		color: var(--muted);
		max-width: 60ch;
	}

	.shelf {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		position: relative;
		text-align: center;
	}

	li.earning {
		outline: 2px solid var(--accent);
	}

	.picture {
		height: 160px;
	}

	h2 {
		margin: 0.6rem 0 0.2rem;
		font-size: 0.95rem;
	}

	li p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.badge {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.empty {
		color: var(--muted);
	}

	.empty a {
		color: var(--ink);
	}
</style>
