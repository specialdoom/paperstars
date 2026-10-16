import {
	CircleGeometry,
	CylinderGeometry,
	DoubleSide,
	Euler,
	Group,
	InstancedMesh,
	LatheGeometry,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	TorusGeometry,
	Vector2,
	Vector3,
	type BufferGeometry
} from 'three';
import { JAR_STAR_SCALE, packStars } from './jar.svelte';
import type { JarShape } from './jarShapes';
import { makeStarTexture } from './starTexture';
import type { StarDesign } from './strip';

// A sealed jar for the shelf: the glass, a lid and the stars piled up inside it, all still.
// The stars share one geometry and are drawn one instanced mesh per design.

/** How the shelf is laid out: jar spacing along a plank, plank spacing, and plank size. */
export const SHELF = { SPACING: 6.2, ROW_HEIGHT: 7.4, PLANK_DEPTH: 3.6, PLANK_THICKNESS: 0.35 };

const LID_HEIGHT = 0.4;
const LID_OVERHANG = 0.14;
const STAR_TEXTURE_SIZE = 128;
/** How the stars look when a jar kept no record of them. */
const PLAIN: StarDesign = { colorA: '#ff8fab', colorB: '#fff3c4', pattern: 'stripes', scale: 3 };

export interface SealedJarModel {
	group: Group;
	/** How far the bottom of the glass is below the group's origin. */
	bottom: number;
	/** Height of the top of the lid above the group's origin. */
	top: number;
	dispose(): void;
}

export function buildSealedJar(
	shape: JarShape,
	stars: number,
	designs: StarDesign[],
	starGeometry: BufferGeometry,
	earning: boolean,
	/** Whether it has its lid on; an open jar shows a gold rim instead. */
	sealed = true
): SealedJarModel {
	const group = new Group();
	const owned: { dispose(): void }[] = [];
	const add = (mesh: Mesh) => {
		group.add(mesh);
		owned.push(mesh.geometry, mesh.material as MeshStandardMaterial);
		return mesh;
	};

	const { profile } = shape;
	const [floorRadius, floorY] = profile[0];
	const [rimRadius, rimY] = profile[profile.length - 1];

	const glass = add(
		new Mesh(
			new LatheGeometry(
				profile.map(([r, y]) => new Vector2(r, y)),
				48
			),
			new MeshStandardMaterial({
				color: '#e2d2ff',
				emissive: '#5a2f9e',
				emissiveIntensity: 0.25,
				transparent: true,
				opacity: 0.24,
				roughness: 0.1,
				side: DoubleSide,
				depthWrite: false
			})
		)
	);
	glass.renderOrder = 1;

	if (floorRadius > 0) {
		const floor = add(
			new Mesh(
				new CircleGeometry(floorRadius, 48),
				new MeshStandardMaterial({
					color: '#e2d2ff',
					transparent: true,
					opacity: 0.35,
					side: DoubleSide,
					depthWrite: false
				})
			)
		);
		floor.position.y = floorY;
		floor.rotation.x = -Math.PI / 2;
		floor.renderOrder = 1;
	}

	if (!sealed) {
		const rim = add(
			new Mesh(
				new TorusGeometry(rimRadius, 0.07, 12, 48),
				new MeshStandardMaterial({
					color: '#ffd77a',
					emissive: '#ffb84d',
					emissiveIntensity: 0.35,
					metalness: 0.6,
					roughness: 0.25
				})
			)
		);
		rim.position.y = rimY;
		rim.rotation.x = Math.PI / 2;
	}

	// a gold lid, glowing brighter on a jar that is giving luck, tied on with a pink ribbon
	const lidRadius = rimRadius + LID_OVERHANG;
	const lid = add(
		new Mesh(
			new CylinderGeometry(lidRadius, lidRadius, LID_HEIGHT, 48),
			new MeshStandardMaterial({
				color: '#ffd77a',
				emissive: '#ffb84d',
				emissiveIntensity: earning ? 0.7 : 0.25,
				metalness: 0.6,
				roughness: 0.3
			})
		)
	);
	lid.position.y = rimY + LID_HEIGHT / 2;
	lid.visible = sealed;

	const ribbon = add(
		new Mesh(
			new TorusGeometry(rimRadius + 0.03, 0.08, 12, 48),
			new MeshStandardMaterial({ color: '#ff8ad8', emissive: '#ff4fbf', emissiveIntensity: 0.3 })
		)
	);
	ribbon.position.y = rimY - 0.18;
	ribbon.rotation.x = Math.PI / 2;
	ribbon.visible = sealed;

	// the stars, in the same pile the jar would have settled them in
	const placements = packStars(stars, shape);
	const samples = designs.length ? designs : [PLAIN];
	const matrix = new Matrix4();
	const position = new Vector3();
	const rotation = new Quaternion();
	const euler = new Euler();
	const scale = new Vector3().setScalar(JAR_STAR_SCALE);
	samples.forEach((design, d) => {
		const mine = placements.filter((placement, i) => placement && i % samples.length === d);
		if (!mine.length) return;
		const texture = makeStarTexture(design, STAR_TEXTURE_SIZE);
		const material = new MeshStandardMaterial({ map: texture, roughness: 0.85 });
		const mesh = new InstancedMesh(starGeometry, material, mine.length);
		mine.forEach((placement, i) => {
			position.set(...placement!.position);
			rotation.setFromEuler(euler.set(...placement!.rotation));
			mesh.setMatrixAt(i, matrix.compose(position, rotation, scale));
		});
		// around the whole pile, not one star at the origin, or it is culled too soon
		mesh.computeBoundingSphere();
		group.add(mesh);
		owned.push(texture, material);
	});

	return {
		group,
		bottom: Math.min(...profile.map(([, y]) => y)),
		top: sealed ? rimY + LID_HEIGHT : rimY,
		dispose() {
			for (const item of owned) item.dispose();
		}
	};
}
