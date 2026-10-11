<script lang="ts">
	import { STRIP_LENGTH, VISIBLE_END, VISIBLE_START } from '#lib/fold.ts';
	import { drawStrip, type StarDesign } from '#lib/strip.ts';

	let { design }: { design: StarDesign } = $props();

	const PPU = 32;
	const WIDTH = 640;
	const FULL_HEIGHT = Math.round(WIDTH / STRIP_LENGTH);
	const ZOOM_HEIGHT = Math.round(WIDTH / (VISIBLE_END - VISIBLE_START));
	const GAP = 14;

	const strip = document.createElement('canvas');
	let canvas: HTMLCanvasElement;

	$effect(() => {
		drawStrip(strip, design, PPU);
		const ctx = canvas.getContext('2d')!;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// whole strip, with the part that ends up hidden inside the star faded
		ctx.drawImage(strip, 0, 0, WIDTH, FULL_HEIGHT);
		const from = (VISIBLE_START / STRIP_LENGTH) * WIDTH;
		const to = (VISIBLE_END / STRIP_LENGTH) * WIDTH;
		ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
		ctx.fillRect(0, 0, from, FULL_HEIGHT);
		ctx.fillRect(to, 0, WIDTH - to, FULL_HEIGHT);
		ctx.strokeStyle = '#3b3352';
		ctx.lineWidth = 2;
		ctx.strokeRect(from, 1, to - from, FULL_HEIGHT - 2);

		// close-up of the visible part
		ctx.drawImage(
			strip,
			VISIBLE_START * PPU,
			0,
			(VISIBLE_END - VISIBLE_START) * PPU,
			PPU,
			0,
			FULL_HEIGHT + GAP,
			WIDTH,
			ZOOM_HEIGHT
		);
	});
</script>

<canvas bind:this={canvas} width={WIDTH} height={FULL_HEIGHT + GAP + ZOOM_HEIGHT}></canvas>
<p>Only the outlined end of the strip shows on the finished star; the rest is wrapped inside.</p>

<style>
	canvas {
		display: block;
		width: 100%;
		border-radius: 4px;
	}

	p {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
