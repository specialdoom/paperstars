import { PATTERNS, type StarDesign } from './strip';

const STORAGE_KEY = 'paperstars.jar';
export const JAR_CAPACITY = 120;

export const JAR_RADIUS = 2;
export const JAR_HEIGHT = 4.4;
export const JAR_STAR_SCALE = 0.6;

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

function load(): StarDesign[] {
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed.filter(isDesign).slice(0, JAR_CAPACITY) : [];
	} catch {
		return [];
	}
}

function save() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(jar.stars));
	} catch {
		// storage unavailable: the jar just won't persist
	}
}

export const jar = $state({ stars: load() });

export function addStar(design: StarDesign) {
	if (jar.stars.length >= JAR_CAPACITY) return false;
	jar.stars.push({ ...design });
	save();
	return true;
}

export function emptyJar() {
	jar.stars = [];
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
 * Where each star rests in the jar. Stars are dropped one at a time as
 * spheres, each settling in the lowest of a few random spots, so the pile is
 * stable: adding a star never moves the ones already there.
 */
export function packStars(count: number): Placement[] {
	const random = mulberry32(20261010);
	const r = 0.4 * JAR_STAR_SCALE * 1.5;
	const reach = JAR_RADIUS - r - 0.1;
	const placements: Placement[] = [];

	for (let i = 0; i < count; i++) {
		let best: [number, number, number] | undefined;
		for (let attempt = 0; attempt < 12; attempt++) {
			const angle = random() * Math.PI * 2;
			const distance = Math.sqrt(random()) * reach;
			const x = Math.cos(angle) * distance;
			const z = Math.sin(angle) * distance;
			let y = r;
			for (const { position: p } of placements) {
				const gap = (2 * r) ** 2 - (p[0] - x) ** 2 - (p[2] - z) ** 2;
				if (gap > 0) y = Math.max(y, p[1] + Math.sqrt(gap));
			}
			if (!best || y < best[1]) best = [x, y, z];
		}
		placements.push({
			position: best!,
			rotation: [random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2]
		});
	}
	return placements;
}
