import { BufferAttribute, BufferGeometry } from 'three';
import { RADIUS } from './fold';
import { faceUV } from './starTexture';

const DEG = Math.PI / 180;
/** Angular steps from a corner to the middle of a side. */
const HALF_SIDE_STEPS = 8;
const AROUND = HALF_SIDE_STEPS * 10;
const RINGS = 10;
const FACE_VERTICES = 1 + RINGS * AROUND;

// Each face is a disc of rings around a centre vertex; ring vertices are spread
// over the flat pentagon, which is also where their texture coordinates come from.
const FLAT = Array.from({ length: AROUND }, (_, i) => {
	const angle = 90 * DEG + (i * 36 * DEG) / HALF_SIDE_STEPS;
	// angle from the middle of the nearest side, -36°..36°
	const local = (((i % (2 * HALF_SIDE_STEPS)) - HALF_SIDE_STEPS) * 36 * DEG) / HALF_SIDE_STEPS;
	const radius = (RADIUS * Math.cos(36 * DEG)) / Math.cos(local);
	return {
		x: radius * Math.cos(angle),
		y: radius * Math.sin(angle),
		/** 1 at the middle of a side, 0 at a corner. */
		side: Math.cos((local / (72 * DEG)) * Math.PI),
		/** Which pentagon side the vertex lies on; corners sit still, so either neighbour does. */
		edge: Math.floor(i / (2 * HALF_SIDE_STEPS))
	};
});
// rings crowd towards the rim, where the surface curves the most
const RING_RADIUS = Array.from({ length: RINGS }, (_, j) => Math.sin(((j + 1) / RINGS) * (Math.PI / 2)));

const vertexIndex = (face: 0 | 1, ring: number, i: number) =>
	face * FACE_VERTICES + 1 + ring * AROUND + (i % AROUND);

function buildIndex() {
	const index: number[] = [];
	// faces wind counter-clockwise seen from outside, so the bottom one is reversed
	const triangle = (face: 0 | 1, a: number, b: number, c: number) =>
		face ? index.push(a, c, b) : index.push(a, b, c);

	for (const face of [0, 1] as const) {
		const center = face * FACE_VERTICES;
		for (let i = 0; i < AROUND; i++) {
			triangle(face, center, vertexIndex(face, 0, i), vertexIndex(face, 0, i + 1));
			for (let ring = 0; ring < RINGS - 1; ring++) {
				const a = vertexIndex(face, ring, i);
				const b = vertexIndex(face, ring, i + 1);
				const c = vertexIndex(face, ring + 1, i + 1);
				const d = vertexIndex(face, ring + 1, i);
				triangle(face, a, d, c);
				triangle(face, a, c, b);
			}
		}
	}
	// rim joining the two faces
	for (let i = 0; i < AROUND; i++) {
		const top = vertexIndex(0, RINGS - 1, i);
		const topNext = vertexIndex(0, RINGS - 1, i + 1);
		const bottom = vertexIndex(1, RINGS - 1, i);
		const bottomNext = vertexIndex(1, RINGS - 1, i + 1);
		index.push(bottom, bottomNext, topNext, bottom, topNext, top);
	}
	return index;
}

function buildUVs() {
	const uvs: number[] = [];
	for (const face of [0, 1] as const) {
		uvs.push(...faceUV(face, 0, 0));
		for (const r of RING_RADIUS) for (const { x, y } of FLAT) uvs.push(...faceUV(face, x * r, y * r));
	}
	return uvs;
}

/** How far a fully pinched side moves in, as a share of its distance from the middle. */
export const PINCH = 0.38;

/**
 * Star vertices for a given puff, one value per pentagon side: 0 is the flat
 * wrapped pentagon, 1 is the finished star with that side pinched in. The
 * faces bulge out as more sides are pinched.
 */
function buildPositions(puff: number[]) {
	const overall = puff.reduce((sum, value) => sum + value, 0) / puff.length;
	const tipScale = 1 - 0.08 * overall;
	const rim = RADIUS * 0.05;
	const bulge = RADIUS * 0.45 * overall;

	const positions: number[] = [];
	for (const sign of [1, -1]) {
		positions.push(0, 0, sign * (rim + bulge));
		for (const r of RING_RADIUS) {
			// a pillow profile that rolls over into the rim
			const dome = (1 - r * r) ** 0.6;
			for (const { x, y, side, edge } of FLAT) {
				const scale = r * (tipScale + (1 - PINCH * puff[edge] - tipScale) * side);
				// the pinched sides sit lower, leaving soft ridges out to the tips
				const height = rim + bulge * dome * (1 - 0.35 * side * r * puff[edge]);
				positions.push(x * scale, y * scale, sign * height);
			}
		}
	}
	return positions;
}

const FULL = [1, 1, 1, 1, 1];

/**
 * Points on the surface of the finished star, as a shape for collisions: on each face the
 * peak, and every other ring along the ridges out to the tips and down the middle of the
 * sides. Their hull follows the star's rounded faces, so nothing it rests against shows
 * through it.
 */
export const STAR_HULL = (() => {
	const positions = buildPositions(FULL);
	const points: number[] = [];
	for (const face of [0, 1] as const) {
		points.push(...positions.slice(face * FACE_VERTICES * 3, face * FACE_VERTICES * 3 + 3));
		for (let ring = 1; ring < RINGS; ring += 2) {
			for (let i = 0; i < AROUND; i += HALF_SIDE_STEPS) {
				const vertex = vertexIndex(face, ring, i);
				points.push(...positions.slice(vertex * 3, vertex * 3 + 3));
			}
		}
	}
	return new Float32Array(points);
})();

export function createStarGeometry(puff = FULL) {
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(buildPositions(puff)), 3));
	geometry.setAttribute('uv', new BufferAttribute(new Float32Array(buildUVs()), 2));
	geometry.setIndex(buildIndex());
	geometry.computeVertexNormals();
	return geometry;
}

export function setStarPuff(geometry: BufferGeometry, puff: number[]) {
	const position = geometry.getAttribute('position') as BufferAttribute;
	position.set(buildPositions(puff));
	position.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
}
