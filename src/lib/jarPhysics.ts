import type { RigidBody } from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { JAR_HEIGHT, JAR_RADIUS, JAR_STAR_SCALE, type Placement } from './jar.svelte';
import { STAR_HULL } from './starGeometry';

// The jar is a hollow kinematic body the stars are trapped in: tilting it
// moves its walls, and the stars tumble under gravity in response.

const HALF_HEIGHT = JAR_HEIGHT / 2;
/** Middle of the jar, which it tilts around. */
export const JAR_CENTER = new Vector3(0, HALF_HEIGHT, 0);

const GRAVITY = -20;
const WALL_SEGMENTS = 20;
// thick, so a hard shake cannot push a star through the glass
const WALL_HALF_THICKNESS = 0.2;
const MAX_STEP = 1 / 30;

export type JarPhysics = Awaited<ReturnType<typeof createJarPhysics>>;

export async function createJarPhysics() {
	// the engine is a large WebAssembly module, so it only loads once the jar is shown
	const RAPIER = await import('@dimforge/rapier3d-compat');
	await RAPIER.init();

	const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
	const jar = world.createRigidBody(
		RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, HALF_HEIGHT, 0)
	);

	const inner = JAR_RADIUS - 0.05;
	for (const y of [-1, 1]) {
		// floor, and an invisible lid so stars stay in when the jar is tipped over
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(JAR_RADIUS + 0.5, WALL_HALF_THICKNESS, JAR_RADIUS + 0.5)
				.setTranslation(0, y * (HALF_HEIGHT + WALL_HALF_THICKNESS), 0)
				.setFriction(0.6),
			jar
		);
	}
	const distance = inner + WALL_HALF_THICKNESS;
	for (let i = 0; i < WALL_SEGMENTS; i++) {
		const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(
				WALL_HALF_THICKNESS,
				HALF_HEIGHT,
				distance * Math.tan(Math.PI / WALL_SEGMENTS) + 0.05
			)
				.setTranslation(Math.cos(angle) * distance, 0, Math.sin(angle) * distance)
				.setRotation({ x: 0, y: Math.sin(-angle / 2), z: 0, w: Math.cos(-angle / 2) })
				.setFriction(0.4),
			jar
		);
	}

	const hull = STAR_HULL.map((value) => value * JAR_STAR_SCALE);
	const stars: RigidBody[] = [];
	const tilt = new Quaternion();
	const position = new Vector3();
	const rotation = new Quaternion();
	const euler = new Euler();
	const spread = (range: number) => (Math.random() * 2 - 1) * range;

	return {
		stars,

		/** Adds a star at rest where `resting` says, or dropping in from the top of the jar. */
		addStar(resting?: Placement) {
			const body = RAPIER.RigidBodyDesc.dynamic()
				.setLinearDamping(0.2)
				.setAngularDamping(0.6)
				.setCcdEnabled(true);

			if (resting) {
				position.set(...resting.position);
				rotation.setFromEuler(euler.set(...resting.rotation));
			} else {
				position
					.set(spread(0.6), HALF_HEIGHT - 0.5, spread(0.6))
					.applyQuaternion(tilt)
					.add(JAR_CENTER);
				rotation.setFromEuler(euler.set(spread(Math.PI), spread(Math.PI), spread(Math.PI)));
				body.setAngvel({ x: spread(5), y: spread(5), z: spread(5) });
			}
			body.setTranslation(position.x, position.y, position.z).setRotation(rotation);

			const star = world.createRigidBody(body);
			world.createCollider(
				RAPIER.ColliderDesc.convexHull(hull)!.setFriction(0.6).setRestitution(0.3),
				star
			);
			stars.push(star);
		},

		clear() {
			for (const star of stars) world.removeRigidBody(star);
			stars.length = 0;
		},

		/**
		 * Advances the simulation with the jar tilted to `jarRotation`.
		 * Returns whether anything is still moving.
		 */
		step(delta: number, jarRotation: Quaternion) {
			const moved = tilt.angleTo(jarRotation) > 1e-5;
			tilt.copy(jarRotation);
			jar.setNextKinematicRotation(tilt);
			// resting stars are asleep and would otherwise ignore the walls moving under them
			if (moved) for (const star of stars) star.wakeUp();

			world.timestep = Math.min(delta, MAX_STEP);
			world.step();
			return moved || stars.some((star) => !star.isSleeping());
		},

		dispose() {
			world.free();
		}
	};
}
