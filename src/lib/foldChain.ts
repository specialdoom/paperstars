import {
	BufferAttribute,
	BufferGeometry,
	DoubleSide,
	Group,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Vector3,
	type Texture
} from 'three';
import { CREASES, END_CUT, LEAD_CREASE, STRIP_LENGTH, WRAP_SEQUENCE, type Crease } from './fold';

// The paper strip as a chain of flat pieces hinged along its creases. Every
// piece keeps its flat strip coordinates; each hinge swings everything after
// it around its crease, so closing the hinges one by one wraps the pentagon.

/** Gap between stacked paper layers. */
const LAYER = 0.004;

const [a, b, c, d, e, f] = WRAP_SEQUENCE[0].matrix;
/** Turn that lays the unfolded strip horizontally; a multiple of 72°, so the pentagon is unchanged. */
export const STRIP_ANGLE = -Math.atan2(b, a);
// strip coordinates -> scene, with the first wrap already on the pentagon
const PLACEMENT = new Matrix4()
	.makeRotationZ(STRIP_ANGLE)
	.multiply(new Matrix4().set(a, c, 0, e, b, d, 0, f, 0, 0, 1, 0, 0, 0, 0, 1));

/** Middle of the unfolded strip, in scene coordinates. */
export const STRIP_CENTER = new Vector3(STRIP_LENGTH / 2, 0.5, 0).applyMatrix4(PLACEMENT);

/** Number of hinges that close to wrap the whole strip. */
export const FOLDS = CREASES.length - 1;

function piece(left: Crease, right: Crease) {
	const corners = [left[0], right[0], right[1], left[1]];
	const geometry = new BufferGeometry();
	geometry.setAttribute(
		'position',
		new BufferAttribute(new Float32Array(corners.flatMap(([x, y]) => [x, y, 0])), 3)
	);
	geometry.setAttribute(
		'uv',
		new BufferAttribute(new Float32Array(corners.flatMap(([x, y]) => [x / STRIP_LENGTH, 1 - y])), 2)
	);
	geometry.setIndex([0, 1, 2, 0, 2, 3]);
	geometry.computeVertexNormals();
	return geometry;
}

function hinge(parent: Group, [p, q]: Crease, direction: 1 | -1) {
	const axis = new Vector3(q[0] - p[0], q[1] - p[1], 0).normalize().multiplyScalar(direction);
	const pivot = new Group();
	pivot.position.set(p[0], p[1], 0);
	const body = new Group();
	pivot.add(body);
	parent.add(pivot);
	return {
		body,
		/** `t` from 0 (flat) to 1 (folded back); `lift` is how far the folded piece sits off its parent. */
		set(t: number, lift: number) {
			pivot.quaternion.setFromAxisAngle(axis, t * Math.PI);
			body.position.set(-p[0], -p[1], lift * t);
		}
	};
}

/** How the paper to grab lights up. */
export const GLOW_COLOR = '#ffe08a';
export const GLOW_STRENGTH = 0.7;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
// wraps alternate faces, so every second one starts a new layer
const layer = (k: number) => Math.ceil(k / 2);
/** How far above the wrap it folds from wrap `k` comes to rest, through the pentagon. */
function lift(k: number) {
	// the end of the strip is tucked in: it slips under the wrap before it on its face
	const tucked = k === CREASES.length - 1 ? 1.5 : 0;
	return (layer(k - 1) + layer(k) - tucked) * LAYER;
}

export function createFoldChain(texture: Texture) {
	const material = new MeshStandardMaterial({ map: texture, side: DoubleSide, roughness: 0.85 });
	// the paper to grab lights up when the user drags somewhere else
	const glowing = material.clone();
	glowing.emissive.set(GLOW_COLOR);
	const geometries: BufferGeometry[] = [];
	const add = (parent: Group, left: Crease, right: Crease) => {
		const geometry = piece(left, right);
		geometries.push(geometry);
		const mesh = new Mesh(geometry, material);
		parent.add(mesh);
		return mesh;
	};

	const root = new Group();
	root.applyMatrix4(PLACEMENT);
	add(root, LEAD_CREASE, CREASES[0]);

	const lead = hinge(root, LEAD_CREASE, -1);
	const leadPiece = add(
		lead.body,
		[
			[0, 0],
			[0, 1]
		],
		LEAD_CREASE
	);

	const hinges: ReturnType<typeof hinge>[] = [];
	/** The piece each hinge swings. */
	const pieces: Mesh[] = [];
	let parent = root;
	for (let k = 1; k < CREASES.length; k++) {
		const h = hinge(parent, CREASES[k - 1], 1);
		pieces.push(add(h.body, CREASES[k - 1], k < CREASES.length - 1 ? CREASES[k] : END_CUT));
		hinges.push(h);
		parent = h.body;
	}

	return {
		root,
		/** `folds`: how many hinges are closed (fractional while one is moving); `tuck`: the leading tail. */
		setProgress(folds: number, tuck: number) {
			lead.set(clamp01(tuck), LAYER / 2);
			hinges.forEach((h, i) => h.set(clamp01(folds - i), lift(i + 1)));
		},
		/**
		 * The crease hinge `index` folds along (`'lead'` for the leading tail). Its points are strip
		 * coordinates in `frame`; the paper still to fold lies towards `loose` along the strip.
		 */
		crease(index: number | 'lead'): { frame: Group; crease: Crease; loose: 1 | -1 } {
			if (index === 'lead') return { frame: root, crease: LEAD_CREASE, loose: -1 };
			return { frame: index ? hinges[index - 1].body : root, crease: CREASES[index], loose: 1 };
		},
		/** Lights up the paper that hinge `index` (or the leading tail) folds over, by `amount` from 0 to 1. */
		glow(index: number | 'lead' | null, amount: number) {
			glowing.emissiveIntensity = amount * GLOW_STRENGTH;
			const lit = (mesh: Mesh, loose: boolean) =>
				(mesh.material = loose && amount > 0 ? glowing : material);
			lit(leadPiece, index === 'lead');
			pieces.forEach((mesh, k) => lit(mesh, typeof index === 'number' && k >= index));
		},
		dispose() {
			material.dispose();
			glowing.dispose();
			for (const geometry of geometries) geometry.dispose();
		}
	};
}
