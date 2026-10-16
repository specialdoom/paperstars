import { STRIP_LENGTH } from './fold';

export const PATTERNS = ['solid', 'stripes', 'dots', 'checks', 'gradient'] as const;
export type Pattern = (typeof PATTERNS)[number];

export interface StarDesign {
	colorA: string;
	colorB: string;
	pattern: Pattern;
	/** Pattern size, 1 (fine) to 5 (bold). */
	scale: number;
}

const STRIPE_PERIOD = [0.2, 0.3, 0.45, 0.65, 0.9];
const CELLS_ACROSS = [8, 6, 4, 3, 2];

/**
 * Paints the flat paper strip; `ppu` is pixels per strip width. `edges` shades
 * the long edges so overlapping layers stay readable once folded.
 */
export function drawStrip(
	canvas: HTMLCanvasElement,
	design: StarDesign,
	ppu: number,
	edges = false
) {
	const w = STRIP_LENGTH * ppu;
	const h = ppu;
	if (canvas.width !== w) canvas.width = w;
	if (canvas.height !== h) canvas.height = h;

	const ctx = canvas.getContext('2d')!;
	const step = Math.min(Math.max(Math.round(design.scale), 1), 5) - 1;
	ctx.fillStyle = design.colorA;
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = design.colorB;

	switch (design.pattern) {
		case 'stripes': {
			const period = STRIPE_PERIOD[step] * ppu;
			for (let x = -h; x < w; x += period) {
				ctx.beginPath();
				ctx.moveTo(x, h);
				ctx.lineTo(x + period / 2, h);
				ctx.lineTo(x + period / 2 + h, 0);
				ctx.lineTo(x + h, 0);
				ctx.fill();
			}
			break;
		}
		case 'dots': {
			const cell = h / CELLS_ACROSS[step];
			for (let row = 0; row < CELLS_ACROSS[step]; row++) {
				const offset = row % 2 ? cell / 2 : 0;
				for (let x = offset + cell / 2; x < w + cell; x += cell) {
					ctx.beginPath();
					ctx.arc(x, (row + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			break;
		}
		case 'checks': {
			const cell = h / CELLS_ACROSS[step];
			for (let row = 0; row < CELLS_ACROSS[step]; row++) {
				for (let col = row % 2; col * cell < w; col += 2) {
					ctx.fillRect(col * cell, row * cell, cell, cell);
				}
			}
			break;
		}
		case 'gradient': {
			const gradient = ctx.createLinearGradient(0, 0, 0, h);
			gradient.addColorStop(0, design.colorA);
			gradient.addColorStop(1, design.colorB);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, w, h);
			break;
		}
	}

	if (edges) {
		const line = Math.max(1, ppu * 0.025);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
		ctx.fillRect(0, 0, w, line);
		ctx.fillRect(0, h - line, w, line);
	}
}

function hslToHex(h: number, s: number, l: number) {
	const a = s * Math.min(l, 1 - l);
	const channel = (n: number) => {
		const k = (n + h / 30) % 12;
		const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(value * 255)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** A random design, using one of `patterns`. */
export function randomDesign(patterns: readonly Pattern[] = PATTERNS): StarDesign {
	const hue = Math.random() * 360;
	const shift = 20 + Math.random() * 140;
	return {
		colorA: hslToHex(hue, 0.6 + Math.random() * 0.3, 0.55 + Math.random() * 0.2),
		colorB: hslToHex((hue + shift) % 360, 0.5 + Math.random() * 0.4, 0.75 + Math.random() * 0.2),
		pattern: patterns[Math.floor(Math.random() * patterns.length)],
		scale: 1 + Math.floor(Math.random() * 5)
	};
}
