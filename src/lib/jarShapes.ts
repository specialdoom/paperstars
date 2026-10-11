// Every jar is a shape turned around its vertical axis, described by the
// outline of its inside wall. The glass, the walls the stars bump into and
// the pile of stars it starts with are all made from that outline.

/** A point of the outline: distance from the axis, and height above the jar's middle. */
export type ProfilePoint = [radius: number, y: number];

export interface JarShape {
	id: string;
	name: string;
	/** Inside wall from the bottom up. A bottom that starts away from the axis is closed by a flat floor. */
	profile: ProfilePoint[];
}

const DEG = Math.PI / 180;

function arc(radius: number, centerY: number, from: number, to: number, steps: number) {
	return Array.from({ length: steps + 1 }, (_, i): ProfilePoint => {
		const angle = (from + ((to - from) * i) / steps) * DEG;
		// exactly on the axis at the pole, rather than a rounding error away from it
		return [i === 0 && from === -90 ? 0 : radius * Math.cos(angle), centerY + radius * Math.sin(angle)];
	});
}

const GLOBE = arc(2.4, 0, -90, 57, 16);
const TUBE_RADIUS = 1.05;
const TUBE_HALF_HEIGHT = 2.8;

export const JAR_SHAPES: JarShape[] = [
	{
		id: 'jar',
		name: 'Jar',
		profile: [
			[2, -2.2],
			[2, 2.2]
		]
	},
	{
		id: 'globe',
		name: 'Globe',
		// a ball with a short collar around its opening
		profile: [...GLOBE, [GLOBE[GLOBE.length - 1][0], GLOBE[GLOBE.length - 1][1] + 0.3]]
	},
	{
		id: 'tube',
		name: 'Test tube',
		profile: [
			...arc(TUBE_RADIUS, TUBE_RADIUS - TUBE_HALF_HEIGHT, -90, 0, 6),
			[TUBE_RADIUS, TUBE_HALF_HEIGHT]
		]
	},
	{
		id: 'flask',
		name: 'Flask',
		profile: [
			[2.4, -2.2],
			[2.4, -1.9],
			[0.9, 1.3],
			[0.9, 2.2]
		]
	}
];

export function findShape(id: unknown) {
	return JAR_SHAPES.find((shape) => shape.id === id);
}

/** Inside radius of the jar at height `y`; 0 above and below it. */
export function radiusAt({ profile }: JarShape, y: number) {
	for (let i = 1; i < profile.length; i++) {
		const [r0, y0] = profile[i - 1];
		const [r1, y1] = profile[i];
		if (y >= y0 && y <= y1) return y1 === y0 ? Math.max(r0, r1) : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
	}
	return 0;
}
