// Geometry of folding a lucky star: a strip of width 1 is wrapped around a
// regular pentagon, each wrap crossing a face between one side and the
// diagonal parallel to it, then folding over the next side onto the other face.

/** 2D affine transform in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f */
export type Mat = [number, number, number, number, number, number];
export type Point = [number, number];

const DEG = Math.PI / 180;
const PHI = (1 + Math.sqrt(5)) / 2;

/** Strip length in strip widths. */
export const STRIP_LENGTH = 26;
/** Pentagon side: the strip exactly spans a side and its parallel diagonal. */
export const SIDE = 1 / Math.sin(72 * DEG);
/** Pentagon circumradius. */
export const RADIUS = SIDE / (2 * Math.sin(36 * DEG));
/** Strip length used up by one wrap. */
export const ADVANCE = (SIDE * (1 + PHI)) / 2;

/** Short tail left over before the first wrap, tucked in after the knot. */
const LEAD = 0.8;
const START = LEAD + SIDE * Math.cos(72 * DEG);
export const WRAPS = Math.floor((STRIP_LENGTH - START) / ADVANCE);
/** Three wraps cover a face, so only the last six wraps show on the star. */
export const VISIBLE_WRAPS = 6;
export const VISIBLE_END = START + WRAPS * ADVANCE;
export const VISIBLE_START = VISIBLE_END - VISIBLE_WRAPS * ADVANCE;

/** Pentagon corners, counter-clockwise from the top. */
export const PENTAGON: Point[] = Array.from({ length: 5 }, (_, i) => {
	const a = (90 + 72 * i) * DEG;
	return [RADIUS * Math.cos(a), RADIUS * Math.sin(a)];
});

/** m1 ∘ m2: applies m2 first. */
export function mul(m1: Mat, m2: Mat): Mat {
	const [a1, b1, c1, d1, e1, f1] = m1;
	const [a2, b2, c2, d2, e2, f2] = m2;
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1
	];
}

export function apply(m: Mat, [x, y]: Point): Point {
	return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function invert([a, b, c, d, e, f]: Mat): Mat {
	const det = a * d - b * c;
	return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

function reflection(p: Point, q: Point): Mat {
	const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
	const dx = (q[0] - p[0]) / len;
	const dy = (q[1] - p[1]) / len;
	const a = 2 * dx * dx - 1;
	const b = 2 * dx * dy;
	const d = 2 * dy * dy - 1;
	return [a, b, b, d, p[0] - (a * p[0] + b * p[1]), p[1] - (b * p[0] + d * p[1])];
}

export interface Wrap {
	/** 0 = top face, 1 = bottom face */
	face: 0 | 1;
	/** Maps strip coordinates (x along the length, y across the width) onto the pentagon. */
	matrix: Mat;
}

function computeWraps(): Wrap[] {
	const [p0, p1] = PENTAGON;
	const ux = (p1[0] - p0[0]) / SIDE;
	const uy = (p1[1] - p0[1]) / SIDE;
	// first wrap runs along side 0, with the strip's y axis pointing into the pentagon
	let m: Mat = [ux, uy, -uy, ux, p0[0] - START * ux, p0[1] - START * uy];

	const wraps: Wrap[] = [];
	for (let k = 0; k < WRAPS; k++) {
		wraps.push({ face: (k % 2) as 0 | 1, matrix: m });
		const fold = (2 * k + 1) % 5;
		m = mul(reflection(PENTAGON[fold], PENTAGON[(fold + 1) % 5]), m);
	}
	return wraps;
}

export const WRAP_SEQUENCE = computeWraps();

/** A crease across the strip, as its end on the y = 0 edge and its end on the y = 1 edge. */
export type Crease = [Point, Point];

/** Crease k ends wrap k: the pentagon side the strip folds over, in strip coordinates. */
export const CREASES: Crease[] = WRAP_SEQUENCE.map(({ matrix }, k) => {
	const side = (2 * k + 1) % 5;
	const toStrip = invert(matrix);
	const ends = [apply(toStrip, PENTAGON[side]), apply(toStrip, PENTAGON[(side + 1) % 5])];
	return (ends[0][1] < ends[1][1] ? ends : ends.reverse()) as Crease;
});

/** Where the leading tail meets the first wrap. */
export const LEAD_CREASE: Crease = [
	[START, 0],
	[LEAD, 1]
];
