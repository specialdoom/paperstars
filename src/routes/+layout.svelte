<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
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
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700&display=swap"
	/>
</svelte:head>

<nav class="bar">
	<a class="brand" href={resolve('/')}><span aria-hidden="true">✦</span> Paper Stars</a>
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

<ConfirmDialog />

<style>
	/* A magical night sky: deep violet, pink and cyan glows, gold stars. */
	:global(:root) {
		color-scheme: dark;
		--ink: #fbf4ff;
		--muted: #c6b7ec;
		--panel: rgba(38, 22, 88, 0.62);
		--panel-edge: rgba(255, 190, 240, 0.3);
		--line: rgba(255, 220, 255, 0.2);
		--field: rgba(255, 255, 255, 0.08);
		--accent: #ff8ad8;
		--accent-2: #8fe9ff;
		--gold: #ffd77a;
		--magic: linear-gradient(135deg, #ff8ad8 0%, #b98cff 55%, #8fe9ff 100%);
		--glow: 0 0 18px rgba(255, 138, 216, 0.45);
		--display: 'Fredoka', 'Nunito', system-ui, sans-serif;
		font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: var(--ink);
	}

	:global(body) {
		margin: 0;
		min-height: 100vh;
		background:
			radial-gradient(ellipse at 12% 8%, rgba(255, 120, 210, 0.3), transparent 45%),
			radial-gradient(ellipse at 88% 18%, rgba(110, 220, 255, 0.22), transparent 45%),
			radial-gradient(ellipse at 50% 105%, rgba(170, 110, 255, 0.4), transparent 55%),
			linear-gradient(170deg, #110930 0%, #231255 45%, #3a1a6c 100%);
		background-attachment: fixed;
	}

	/* two layers of tiny stars, one of them twinkling */
	:global(body::before),
	:global(body::after) {
		content: '';
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
	}

	:global(body::before) {
		background-image:
			radial-gradient(1px 1px at 23px 41px, #fff, transparent),
			radial-gradient(1px 1px at 97px 133px, #ffe9fb, transparent),
			radial-gradient(1.5px 1.5px at 151px 61px, #fff, transparent),
			radial-gradient(1px 1px at 189px 171px, #d9f7ff, transparent),
			radial-gradient(1px 1px at 61px 187px, #fff, transparent);
		background-size: 210px 210px;
		opacity: 0.7;
	}

	:global(body::after) {
		background-image:
			radial-gradient(2px 2px at 47px 83px, #ffd77a, transparent),
			radial-gradient(1.5px 1.5px at 233px 29px, #fff, transparent),
			radial-gradient(2px 2px at 281px 241px, #ff8ad8, transparent),
			radial-gradient(1.5px 1.5px at 139px 277px, #8fe9ff, transparent);
		background-size: 320px 320px;
		animation: twinkle 4s ease-in-out infinite alternate;
	}

	@keyframes twinkle {
		from {
			opacity: 0.25;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(body::after) {
			animation: none;
			opacity: 0.7;
		}
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(h1),
	:global(h2),
	:global(h3) {
		font-family: var(--display);
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	/* page titles shimmer gold to pink, after a gold sparkle */
	:global(main > h1) {
		background: linear-gradient(90deg, #ffd77a, #ff8ad8 60%, #c9a4ff);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	:global(main > h1::before) {
		content: '✦ ';
		-webkit-text-fill-color: var(--gold);
	}

	:global(a) {
		color: var(--accent-2);
	}

	:global(::selection) {
		background: rgba(255, 138, 216, 0.45);
	}

	:global(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	:global(.panel) {
		background: var(--panel);
		border: 1px solid var(--panel-edge);
		border-radius: 18px;
		padding: 1.1rem;
		box-shadow:
			0 10px 40px rgba(8, 0, 40, 0.45),
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 0 30px rgba(255, 138, 216, 0.06);
		backdrop-filter: blur(10px);
	}

	:global(button) {
		font: inherit;
		font-family: var(--display);
		font-weight: 500;
		font-size: 0.9rem;
		color: var(--ink);
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--field);
		cursor: pointer;
		transition:
			box-shadow 0.2s,
			border-color 0.2s,
			transform 0.1s;
	}

	:global(button:hover:not(:disabled)) {
		border-color: var(--accent);
		box-shadow: var(--glow);
	}

	:global(button:active:not(:disabled)) {
		transform: translateY(1px);
	}

	:global(button:disabled) {
		opacity: 0.45;
		cursor: not-allowed;
	}

	:global(button.primary),
	:global(button.selected) {
		background: var(--magic);
		border-color: transparent;
		color: #1d0b3f;
		font-weight: 600;
	}

	:global(button.primary:not(:disabled)) {
		box-shadow: 0 0 14px rgba(255, 138, 216, 0.35);
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
		background: rgba(17, 9, 48, 0.72);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--panel-edge);
		box-shadow: 0 2px 24px rgba(8, 0, 40, 0.5);
	}

	.brand {
		font-family: var(--display);
		font-weight: 700;
		font-size: 1.3rem;
		background: linear-gradient(90deg, #ffd77a, #ff8ad8 55%, #8fe9ff);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
		text-decoration: none;
		letter-spacing: 0.02em;
		filter: drop-shadow(0 0 8px rgba(255, 138, 216, 0.45));
	}

	.brand span {
		-webkit-text-fill-color: var(--gold);
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
		font-family: var(--display);
		font-weight: 500;
		font-size: 0.95rem;
	}

	ul a:hover {
		color: var(--ink);
	}

	ul a[aria-current='page'] {
		background: var(--magic);
		color: #1d0b3f;
		box-shadow: var(--glow);
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
		font-family: var(--display);
		font-size: 1.2rem;
		color: var(--gold);
		text-shadow: 0 0 10px rgba(255, 215, 122, 0.5);
	}

	.wallet span + span strong {
		color: var(--accent-2);
		text-shadow: 0 0 10px rgba(143, 233, 255, 0.5);
	}

	.wallet small {
		color: var(--accent);
		font-weight: 700;
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
