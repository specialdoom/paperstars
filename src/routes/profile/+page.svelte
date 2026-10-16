<script lang="ts">
	import { game, luckPerSecond, rename, resetGame } from '#lib/game.svelte.ts';

	let name = $state(game.name);
	const saved = $derived(name.trim() === game.name);

	const stats = $derived([
		['Stars folded', game.stats.folded],
		['Folded all by hand', game.stats.byHand],
		['Jars sealed', game.shelf.length],
		['Luck earned', Math.floor(game.stats.luckEarned)],
		['Luck per second', luckPerSecond().toFixed(2)]
	] as const);

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		rename(name);
		name = game.name;
	}

	function reset() {
		if (confirm('Start over? This forgets your luck, wishes, upgrades, shelf and jar.')) resetGame();
	}
</script>

<svelte:head>
	<title>Profile · Paper Stars</title>
</svelte:head>

<main>
	<h1>Profile</h1>

	<section class="panel">
		<h2>Your name</h2>
		<form {onsubmit}>
			<input
				bind:value={name}
				maxlength="24"
				placeholder="Pick a name"
				autocomplete="nickname"
				aria-label="Your name"
			/>
			<button type="submit" class="primary" disabled={saved}>Save</button>
		</form>
		<p class="note">
			It labels your jars and shelf. It is kept in this browser only, so it does not need to be
			unique.
		</p>
	</section>

	<section class="panel">
		<h2>Stats</h2>
		<dl>
			{#each stats as [label, value] (label)}
				<div>
					<dt>{label}</dt>
					<dd>{value.toLocaleString()}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section class="panel">
		<h2>Start over</h2>
		<p class="note">Forget everything in this browser and begin with an empty jar.</p>
		<button type="button" class="danger" onclick={reset}>Reset game</button>
	</section>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 640px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}

	form {
		display: flex;
		gap: 0.5rem;
	}

	input {
		flex: 1;
		min-width: 0;
		font: inherit;
		color: var(--ink);
		padding: 0.45rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--field);
	}

	input:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.note {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	dl {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
		margin: 0;
	}

	dt {
		font-size: 0.8rem;
		color: var(--muted);
	}

	dd {
		margin: 0.15rem 0 0;
		font-family: var(--display);
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--gold);
		font-variant-numeric: tabular-nums;
	}

	.danger {
		margin-top: 0.75rem;
		color: #ff9aa8;
	}
</style>
