<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import { game, luckPerSecond, tick } from '#lib/game.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const TABS = [
		{ path: '/', label: 'Fold' },
		{ path: '/shop', label: 'Shop' },
		{ path: '/shelf', label: 'Shelf' },
		{ path: '/profile', label: 'Profile' }
	] as const;

	const perSecond = $derived(luckPerSecond());

	// sealed jars on the shelf keep giving luck while the game is open
	$effect(() => {
		let last = performance.now();
		const timer = setInterval(() => {
			const now = performance.now();
			tick((now - last) / 1000);
			last = now;
		}, 1000);
		return () => clearInterval(timer);
	});

	function format(value: number) {
		return Math.floor(value).toLocaleString();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="bar">
	<a class="brand" href={resolve('/')}>Paper Stars</a>
	<ul>
		{#each TABS as tab (tab.path)}
			<li>
				<a href={resolve(tab.path)} aria-current={page.url.pathname === resolve(tab.path) ? 'page' : undefined}>
					{tab.label}
				</a>
			</li>
		{/each}
	</ul>
	<div class="wallet" aria-live="polite">
		<span title="Luck: earned by every star, spent in the shop">
			<strong>{format(game.luck)}</strong> luck
			{#if perSecond > 0}<small>+{perSecond.toFixed(1)}/s</small>{/if}
		</span>
		<span title="Wishes: granted for sealing a jar, they unlock patterns and jars">
			<strong>{format(game.wishes)}</strong>
			{game.wishes === 1 ? 'wish' : 'wishes'}
		</span>
		{#if game.name}<a class="name" href={resolve('/profile')}>{game.name}</a>{/if}
	</div>
</nav>

{@render children()}

<style>
	:global(:root) {
		--ink: #3b3352;
		--muted: #7b7393;
		--panel: rgba(255, 255, 255, 0.72);
		--accent: #ff7fa5;
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: var(--ink);
	}

	:global(body) {
		margin: 0;
		min-height: 100vh;
		background: linear-gradient(160deg, #fff4e8 0%, #ffe6f0 45%, #e2ecff 100%) fixed;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(.panel) {
		background: var(--panel);
		border-radius: 16px;
		padding: 1.1rem;
		box-shadow: 0 6px 24px rgba(90, 70, 130, 0.12);
		backdrop-filter: blur(6px);
	}

	:global(button) {
		font: inherit;
		font-size: 0.9rem;
		color: var(--ink);
		padding: 0.45rem 0.85rem;
		border: 1px solid rgba(59, 51, 82, 0.18);
		border-radius: 999px;
		background: white;
		cursor: pointer;
	}

	:global(button:hover:not(:disabled)) {
		border-color: var(--accent);
	}

	:global(button:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(button.primary) {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
		font-weight: 600;
	}

	:global(.visually-hidden) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.bar {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.5rem;
		padding: 0.6rem 1.5rem;
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(8px);
		box-shadow: 0 2px 12px rgba(90, 70, 130, 0.1);
	}

	.brand {
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--ink);
		text-decoration: none;
		letter-spacing: 0.02em;
	}

	ul {
		display: flex;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	ul a {
		display: block;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.95rem;
	}

	ul a:hover {
		color: var(--ink);
	}

	ul a[aria-current='page'] {
		background: var(--ink);
		color: white;
	}

	.wallet {
		display: flex;
		align-items: baseline;
		gap: 1.1rem;
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.wallet strong {
		font-size: 1.15rem;
		color: var(--ink);
	}

	.wallet small {
		color: var(--accent);
		font-weight: 600;
	}

	.name {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}

	@media (max-width: 640px) {
		.bar {
			padding: 0.5rem 1rem;
		}

		.wallet {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
