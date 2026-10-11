<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

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
</style>
