import { JAR_SHAPES, findShape, radiusAt, type JarShape } from './jarShapes';
import { PATTERNS, type StarDesign } from './strip';

const STORAGE_KEY = 'paperstars.jar';
const SHAPE_KEY = 'paperstars.jarShape';

export const JAR_STAR_SCALE = 0.6;
/** More than any jar holds: a jar is full when stars start spilling out of it, well before this. */
export const MAX_STARS = 300;

function isDesign(value: unknown): value is StarDesign {
	const d = value as StarDesign;
	return (
		typeof d === 'object' &&
		d !== null &&
		typeof d.colorA === 'string' &&
		typeof d.colorB === 'string' &&
		PATTERNS.includes(d.pattern) &&
		typeof d.scale === 'number'
	);
}

function load() {
	let stars: StarDesign[] = [];
	let shape = JAR_SHAPES[0];
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (Array.isArray(parsed)) stars = parsed.filter(isDesign).slice(0, MAX_STARS);
		shape = findShape(localStorage.getItem(SHAPE_KEY)) ?? shape;
	} catch {
		// storage unavailable or unreadable: start with an empty jar
	}
	return { stars, shape: shape.id };
}

function save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(jar.stars));
		localStorage.setItem(SHAPE_KEY, jar.shape);
	} catch {
		// storage unavailable: the jar just won't persist
	}
}

export const jar = $state(load());

/** The jar the stars are kept in. */
export function jarShape() {
	return findShape(jar.shape) ?? JAR_SHAPES[0];
}

export function addStar(design: StarDesign) {
	if (jar.stars.length >= MAX_STARS) return false;
	jar.stars.push({ ...design });
	save();
	return true;
}

export function emptyJar() {
	jar.stars = [];
	save();
}

/** Moves the stars to another jar. Those that do not fit will spill out of it. */
export function chooseJar(shape: JarShape) {
	jar.shape = shape.id;
	save();
}

/**
 * Forgets stars that fell out of the jar. `indices` are their places in the
 * jar, each as it was when the ones before it had already been taken out.
 */
export function loseStars(indices: number[]) {
	for (const index of indices) jar.stars.splice(index, 1);
	save();
}

export interface Placement {
	position: [number, number, number];
	rotation: [number, number, number];
}

function mulberry32(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Where each star rests in the jar, relative to the jar's middle. Stars are
 * dropped one at a time as spheres, each settling in the lowest of a few
 * random spots, so the pile is stable: adding a star never moves the ones
 * already there. Once the pile reaches the top, the remaining stars have no placement.
 */
export function packStars(count: number, shape: JarShape): (Placement | undefined)[] {
	const random = mulberry32(20261010);
	const r = 0.4 * JAR_STAR_SCALE * 1.5;
	const bottom = shape.profile[0][1];
	const top = shape.profile[shape.profile.length - 1][1];
	const reach = Math.max(...shape.profile.map(([radius]) => radius)) - r - 0.1;
	const placed: Placement[] = [];
	let full = false;

	return Array.from({ length: count }, () => {
		let best: [number, number, number] | undefined;
		for (let attempt = 0; attempt < 12 && !full; attempt++) {
			const angle = random() * Math.PI * 2;
			const distance = Math.sqrt(random()) * reach;
			const x = Math.cos(angle) * distance;
			const z = Math.sin(angle) * distance;
			// down to where the jar is wide enough, then on top of the stars already there
			let y = bottom + r;
			while (y < top && radiusAt(shape, y) < distance + r) y += 0.05;
			for (const { position: p } of placed) {
				const gap = (2 * r) ** 2 - (p[0] - x) ** 2 - (p[2] - z) ** 2;
				if (gap > 0) y = Math.max(y, p[1] + Math.sqrt(gap));
			}
			// the jar may have narrowed again up there
			if (y > top - r || radiusAt(shape, y) < distance + r) continue;
			if (!best || y < best[1]) best = [x, y, z];
		}
		const rotation: Placement['rotation'] = [
			random() * Math.PI * 2,
			random() * Math.PI * 2,
			random() * Math.PI * 2
		];
		// once one star finds no room the jar is full, and the rest are poured in on top
		if (!best) {
			full = true;
			return undefined;
		}
		const placement = { position: best, rotation };
		placed.push(placement);
		return placement;
	});
}
