import type { Collider, RigidBody } from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { JAR_STAR_SCALE, type Placement } from './jar.svelte';
import { radiusAt, type JarShape } from './jarShapes';
import { STAR_HULL } from './starGeometry';

// The jar is a hollow kinematic body the stars are trapped in: tilting it
// moves its walls, and the stars tumble under gravity in response.

/** Middle of the jar, which it tilts around. */
export const JAR_CENTER = new Vector3(0, 2.2, 0);

const GRAVITY = -20;
const WALL_SEGMENTS = 20;
// Thick, so a hard shake cannot push a star through the glass. Every slab is also much
// bigger than a star in its other directions: a star pressed into one is pushed out
// through the nearest face, which must be the inside one.
const WALL_HALF_THICKNESS = 0.5;
/** How far a slab runs on past the end of its stretch of outline, where that cannot poke into the jar. */
const WALL_OVERRUN = 1;
const WALL_SEAM = 0.03;
const MAX_STEP = 1 / 30;
// However hard the jar is shaken, its walls swing no faster than the stars can
// get out of the way of, and the simulation takes small steps to keep up.
const MAX_TURN_RATE = 6;
const SUBSTEPS = 2;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

// Only a star inside the jar feels its glass. One above the opening or out of the jar,
// whether dropped from above, heaped on a full jar or poured out of a tipped one, only
// bumps into other stars: it falls into the jar, rests on the heap, or falls away.
const JAR_GROUPS = 0x0001ffff;
const OUTSIDE_GROUPS = 0x00040004;
const INSIDE_GROUPS = 0xffffffff;
/** Seconds between stars when many are waiting to be poured in. */
const DROP_INTERVAL = 0.06;
const DROP_ABOVE = 0.7;
/** Stars are let go already falling, so the next one has room. */
const DROP_SPEED = 8;
/** How far under the rim a star counts as inside, and how far over it as out again. */
const INSIDE_DEPTH = 0.3;
const OUTSIDE_HEIGHT = 0.2;
/** A star that has fallen this far below the jar is gone. */
const LOST_BELOW = 9;

export type JarPhysics = Awaited<ReturnType<typeof createJarPhysics>>;

export async function createJarPhysics() {
	// the engine is a large WebAssembly module, so it only loads once the jar is shown
	const RAPIER = await import('@dimforge/rapier3d-compat');
	await RAPIER.init();

	const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
	const jar = world.createRigidBody(
		RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
			JAR_CENTER.x,
			JAR_CENTER.y,
			JAR_CENTER.z
		)
	);

	const hull = STAR_HULL.map((value) => value * JAR_STAR_SCALE);
	const stars: RigidBody[] = [];
	/** Stars not dropped yet, and stars that are not inside the jar. */
	let waiting: RigidBody[] = [];
	const outside = new Set<RigidBody>();
	let spilled: number[] = [];
	let sinceDrop = Infinity;

	let walls: Collider[] = [];
	let shape: JarShape | undefined;
	let top = 0;
	let dropSpread = 0;

	const tilt = new Quaternion();
	const upright = new Quaternion();
	const position = new Vector3();
	const rotation = new Quaternion();
	const lean = new Quaternion();
	const euler = new Euler();
	const spread = (range: number) => (Math.random() * 2 - 1) * range;

	function clear() {
		for (const star of stars) world.removeRigidBody(star);
		stars.length = 0;
		waiting = [];
		outside.clear();
		spilled = [];
	}

	/** A flat slab closing the bottom of the jar at height `y`. */
	function floor(radius: number, y: number) {
		return world.createCollider(
			RAPIER.ColliderDesc.cuboid(radius + 0.5, WALL_HALF_THICKNESS, radius + 0.5)
				.setTranslation(0, y - WALL_HALF_THICKNESS, 0)
				.setFriction(0.6)
				.setCollisionGroups(JAR_GROUPS),
			jar
		);
	}

	/** Lets a waiting star go, just above the opening. */
	function drop(star: RigidBody) {
		position
			.set(spread(dropSpread), top + DROP_ABOVE, spread(dropSpread))
			.applyQuaternion(tilt)
			.add(JAR_CENTER);
		rotation.setFromEuler(euler.set(spread(Math.PI), spread(Math.PI), spread(Math.PI)));
		star.setTranslation(position, false);
		star.setRotation(rotation, false);
		star.setLinvel({ x: 0, y: -DROP_SPEED, z: 0 }, false);
		star.setAngvel({ x: spread(5), y: spread(5), z: spread(5) }, false);
		star.setEnabled(true);
	}

	/** Keeps track of which stars are inside the jar, which have left it, and which fell away. */
	function follow() {
		if (!shape) return;
		upright.copy(tilt).invert();
		const lost: number[] = [];
		stars.forEach((star, index) => {
			if (!star.isEnabled()) return;
			position.copy(star.translation());
			if (position.y < JAR_CENTER.y - LOST_BELOW) {
				lost.push(index);
				return;
			}
			position.sub(JAR_CENTER).applyQuaternion(upright);
			const wasOutside = outside.has(star);
			if (wasOutside) {
				const inside =
					position.y < top - INSIDE_DEPTH &&
					Math.hypot(position.x, position.z) < radiusAt(shape!, position.y);
				if (!inside) return;
				star.collider(0).setCollisionGroups(INSIDE_GROUPS);
				outside.delete(star);
			} else if (position.y > top + OUTSIDE_HEIGHT) {
				star.collider(0).setCollisionGroups(OUTSIDE_GROUPS);
				outside.add(star);
			}
		});
		// highest first, so taking one out does not move the others still to go
		for (const index of lost.reverse()) {
			outside.delete(stars[index]);
			world.removeRigidBody(stars[index]);
			stars.splice(index, 1);
			spilled.push(index);
		}
	}

	return {
		stars,
		clear,

		/** Rebuilds the jar's walls for a shape. This empties it: the stars have to be added again. */
		setShape(next: JarShape) {
			clear();
			for (const wall of walls) world.removeCollider(wall, false);
			walls = [];
			shape = next;

			const { profile } = next;
			const last = profile.length - 1;
			const [bottomRadius, bottom] = profile[0];
			const topRadius = profile[last][0];
			top = profile[last][1];
			// the top is open: tip the jar far enough and the stars pour out
			if (bottomRadius > 1e-6) walls.push(floor(bottomRadius, bottom));
			dropSpread = Math.min(Math.max(topRadius - 0.65, 0), 0.6);

			// Whether the wall bends inwards at an outline point, as on a ball. There the slabs on
			// either side can run on past it and still stay outside the jar.
			const convex = (i: number) => {
				if (i === 0) return true;
				// nothing may stick up around the opening, where overflowing stars roll off
				if (i === last) return false;
				const [r0, y0] = profile[i - 1];
				const [r1, y1] = profile[i];
				const [r2, y2] = profile[i + 1];
				return (r1 - r0) * (y2 - y1) - (y1 - y0) * (r2 - r1) > -1e-9;
			};

			// each stretch of the outline becomes a ring of slabs lying against it from outside
			for (let i = 1; i <= last; i++) {
				const [r0, y0] = profile[i - 1];
				const [r1, y1] = profile[i];
				const length = Math.hypot(r1 - r0, y1 - y0);
				if (length < 1e-6) continue;
				// along the outline and out of the jar, in the plane through its axis
				const alongR = (r1 - r0) / length;
				const alongY = (y1 - y0) / length;
				const outR = alongY;
				const outY = -alongR;
				const before = convex(i - 1) ? WALL_OVERRUN : WALL_SEAM;
				const after = convex(i) ? WALL_OVERRUN : WALL_SEAM;
				const shift = (after - before) / 2;
				const distance = (r0 + r1) / 2 + alongR * shift + outR * WALL_HALF_THICKNESS;
				const y = (y0 + y1) / 2 + alongY * shift + outY * WALL_HALF_THICKNESS;
				// wide enough to overlap its neighbours around the ring generously
				const halfWidth =
					2 * (Math.max(r0, r1) + WALL_HALF_THICKNESS) * Math.tan(Math.PI / WALL_SEGMENTS) + 0.3;
				lean.setFromAxisAngle(FORWARD, Math.atan2(outY, outR));

				for (let k = 0; k < WALL_SEGMENTS; k++) {
					const angle = (k / WALL_SEGMENTS) * Math.PI * 2;
					rotation.setFromAxisAngle(UP, -angle).multiply(lean);
					walls.push(
						world.createCollider(
							RAPIER.ColliderDesc.cuboid(
								WALL_HALF_THICKNESS,
								(length + before + after) / 2,
								halfWidth
							)
								.setTranslation(Math.cos(angle) * distance, y, Math.sin(angle) * distance)
								.setRotation(rotation)
								.setFriction(0.4)
								.setCollisionGroups(JAR_GROUPS),
							jar
						)
					);
				}
			}
		},

		/**
		 * Adds a star at rest inside the jar where `resting` says, or queues it to be
		 * dropped in from above the opening.
		 */
		addStar(resting?: Placement) {
			const body = RAPIER.RigidBodyDesc.dynamic()
				.setLinearDamping(0.2)
				.setAngularDamping(0.6)
				.setCcdEnabled(true);
			if (resting) {
				position.set(...resting.position).add(JAR_CENTER);
				rotation.setFromEuler(euler.set(...resting.rotation));
				body.setTranslation(position.x, position.y, position.z).setRotation(rotation);
			} else {
				body.setEnabled(false);
			}

			const star = world.createRigidBody(body);
			world.createCollider(
				RAPIER.ColliderDesc.convexHull(hull)!
					.setFriction(0.6)
					.setRestitution(0.3)
					.setCollisionGroups(resting ? INSIDE_GROUPS : OUTSIDE_GROUPS),
				star
			);
			stars.push(star);
			if (!resting) {
				waiting.push(star);
				outside.add(star);
			}
		},

		/** How the jar is tilted right now, which lags behind a fast shake. */
		tilt,

		/**
		 * Advances the simulation with the jar tilting towards `jarRotation`.
		 * Returns whether anything is still moving.
		 */
		step(delta: number, jarRotation: Quaternion) {
			const moved = tilt.angleTo(jarRotation) > 1e-5;
			// resting stars are asleep and would otherwise ignore the walls moving under them
			if (moved) for (const star of stars) star.wakeUp();

			world.timestep = Math.min(delta, MAX_STEP) / SUBSTEPS;
			for (let i = 0; i < SUBSTEPS; i++) {
				sinceDrop += world.timestep;
				if (waiting.length && sinceDrop >= DROP_INTERVAL) {
					drop(waiting.shift()!);
					sinceDrop = 0;
				}
				tilt.rotateTowards(jarRotation, MAX_TURN_RATE * world.timestep);
				jar.setNextKinematicRotation(tilt);
				world.step();
			}
			follow();
			return (
				moved || waiting.length > 0 || stars.some((star) => star.isEnabled() && !star.isSleeping())
			);
		},

		/**
		 * The stars that fell out since the last call, as their places in `stars` at the
		 * moment each was taken out, in that order.
		 */
		takeSpilled() {
			const taken = spilled;
			spilled = [];
			return taken;
		},

		dispose() {
			world.free();
		}
	};
}
