import { CanvasTexture, SRGBColorSpace } from 'three';
import { PENTAGON, RADIUS, VISIBLE_END, VISIBLE_WRAPS, WRAP_SEQUENCE, mul, type Mat } from './fold';
import { drawStrip, type StarDesign } from './strip';

// The texture holds both faces side by side: top face in the left half,
// bottom face in the right half, each pentagon filling FILL of its half.
const FILL = 0.47;

/** Texture coordinates of a point on the flat pentagon. */
export function faceUV(face: 0 | 1, x: number, y: number): [number, number] {
	return [(0.5 + face + (FILL * x) / RADIUS) / 2, 0.5 + (FILL * y) / RADIUS];
}

/** Paints the folded star's faces by laying the strip down wrap by wrap. */
export function drawStarTexture(canvas: HTMLCanvasElement, strip: HTMLCanvasElement, size: number) {
	if (canvas.width !== size * 2) canvas.width = size * 2;
	if (canvas.height !== size) canvas.height = size;

	const ctx = canvas.getContext('2d')!;
	const ppu = strip.height;
	const scale = (FILL * size) / RADIUS;
	const stripToUnits: Mat = [1 / ppu, 0, 0, 1 / ppu, 0, 0];

	// paper behind the pentagons, so mipmaps never bleed an empty background into the rim
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.drawImage(strip, (VISIBLE_END - 1) * ppu, 0, ppu, ppu, 0, 0, canvas.width, canvas.height);

	// earlier wraps are fully hidden; a couple extra guard against seams
	for (const wrap of WRAP_SEQUENCE.slice(-(VISIBLE_WRAPS + 2))) {
		const toPixels: Mat = [scale, 0, 0, -scale, size / 2 + wrap.face * size, size / 2];

		ctx.save();
		ctx.setTransform(...toPixels);
		ctx.beginPath();
		// slightly oversized so the star's rim never samples outside the pentagon
		for (const [x, y] of PENTAGON) ctx.lineTo(x * 1.04, y * 1.04);
		ctx.closePath();
		ctx.clip();

		ctx.setTransform(...mul(toPixels, mul(wrap.matrix, stripToUnits)));
		ctx.drawImage(strip, 0, 0);
		ctx.restore();
	}
}

export function createStarTexture(canvas: HTMLCanvasElement) {
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

/** One-off texture for a finished star. */
export function makeStarTexture(design: StarDesign, size: number) {
	const strip = document.createElement('canvas');
	const canvas = document.createElement('canvas');
	drawStrip(strip, design, Math.max(8, Math.round(size / 8)), true);
	drawStarTexture(canvas, strip, size);
	return createStarTexture(canvas);
}
