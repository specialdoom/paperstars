<script lang="ts">
	import { onDestroy } from 'svelte';
	import { MOUSE, Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three';
	import type { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { ADVANCE, RADIUS, STRIP_LENGTH, VISIBLE_END } from '#lib/fold.ts';
	import {
		FOLDS,
		GLOW_COLOR,
		GLOW_STRENGTH,
		STRIP_ANGLE,
		STRIP_CENTER,
		createFoldChain
	} from '#lib/foldChain.ts';
	import { PINCH, createStarGeometry, setStarPuff } from '#lib/starGeometry.ts';
	import { createStarTexture, drawStarTexture } from '#lib/starTexture.ts';
	import { drawStrip, type StarDesign } from '#lib/strip.ts';

	let {
		design,
		folds,
		tuck,
		puff,
		finished,
		spin = finished,
		manual = null,
		ondrag,
		onrelease,
		oncarry,
		onstep,
		onhold
	}: {
		design: StarDesign;
		/** Wraps folded so far. */
		folds: number;
		/** 0–1: the leading tail folded in. */
		tuck: number;
		/** Per pentagon side: 0 = flat wrapped pentagon, 1 = pinched in. */
		puff: number[];
		/** Wrapping is done: show the star instead of the strip. */
		finished: boolean;
		/** Slowly turn the star around. */
		spin?: boolean;
		/** The move the user makes by dragging the paper, if any; `'carry'` picks the finished star up. */
		manual?: 'fold' | 'tuck' | 'puff' | 'carry' | null;
		/** Called while dragging, with the new value of `folds`, `tuck` or `puff` (of pentagon side `side`). */
		ondrag?: (value: number, side: number) => void;
		onrelease?: () => void;
		/** Called while the star is carried, with where the pointer is on the page; `dropped` once let go. */
		oncarry?: (x: number, y: number, dropped: boolean) => void;
		/** Called for a plain click, which does the next bit of the move in one go. */
		onstep?: () => void;
		/** Called with true once the button has been held down without moving, and false when it is let go. */
		onhold?: (holding: boolean) => void;
	} = $props();

	const { canvas: view, invalidate, size } = useThrelte();

	const FOV = 40;
	const CLOSE_UP = 3.6;
	const MAX_RADIUS = 5;
	/** Where the camera sits relative to what it looks at, before the user orbits. */
	const VIEW = new Vector3(0, -1.6, 3.2);

	const strip = document.createElement('canvas');
	const canvas = document.createElement('canvas');
	const stripTexture = createStarTexture(strip);
	const starTexture = createStarTexture(canvas);
	const geometry = createStarGeometry();
	const chain = createFoldChain(stripTexture);

	let camera = $state<PerspectiveCamera>();
	let controls = $state<ThreeOrbitControls>();
	const direction = new Vector3();
	// the left button is kept for folding the paper
	const MOUSE_BUTTONS = { LEFT: null, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };

	$effect(() => {
		drawStrip(strip, design, 64, true);
		drawStarTexture(canvas, strip, 512);
		stripTexture.needsUpdate = true;
		starTexture.needsUpdate = true;
		invalidate();
	});

	$effect(() => {
		chain.setProgress(folds, tuck);
		invalidate();
	});

	$effect(() => {
		setStarPuff(geometry, puff);
		invalidate();
	});

	// keep the camera framing whatever is left of the strip, zooming in as it wraps up
	$effect(() => {
		if (!camera || !controls) return;
		const opened = Math.min(folds, 1);
		// once folding starts, stay close to the pentagon and let the long end run out of view
		const loose = finished ? 0 : (FOLDS - folds) * ADVANCE;
		const radius = (1 - opened) * (STRIP_LENGTH / 2 + 1) + opened * Math.min(loose + 1.3, MAX_RADIUS);
		const aspect = Math.min(1, $size.width / Math.max($size.height, 1));
		const distance = Math.max(CLOSE_UP, radius / (Math.tan((FOV / 2) * (Math.PI / 180)) * aspect));

		if (folds === 0 && !finished) direction.copy(VIEW).normalize();
		else direction.copy(camera.position).sub(controls.target).normalize();
		controls.target.copy(STRIP_CENTER).multiplyScalar(finished ? 0 : 1 - opened);
		camera.position.copy(controls.target).addScaledVector(direction, distance);
		controls.update();
		invalidate();
	});

	// Manual folding: grabbing the loose paper and dragging it across its crease
	// swings it over, as far as the pointer has got to the other side.
	const PAPER_PLANE = new Plane(new Vector3(0, 0, 1));
	/** How far from the crease the paper counts as held, in strip widths. */
	const GRIP = [0.5, 1.5];
	const MIN_DRAG_PX = 40;
	/** A press that moves less than this before letting go is a click. */
	const CLICK_PX = 6;
	const raycaster = new Raycaster();
	const pointer = new Vector2();
	const hit = new Vector3();
	const local = new Vector3();
	const outward = new Vector3();

	let dragging = $state(false);
	let dragValue: (dx: number, dy: number) => number;
	let dragSide = 0;
	let carrying = false;
	let pressed: { x: number; y: number } | null = null;
	/** Holding the button down this long without moving keeps the folding going until it is let go. */
	const HOLD_MS = 280;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let holding = false;

	function startHold() {
		holding = true;
		missed = null;
		// a press on the paper that never moved was not a drag after all
		if (dragging) {
			dragging = false;
			view.style.cursor = '';
		}
		onhold?.(true);
	}
	/** Where a press that missed the paper started, until it turns into a drag. */
	let missed: { x: number; y: number } | null = null;

	// Dragging anywhere but the paper makes the part to drag light up for a moment.
	const GLOW_MS = 1400;
	const GLOW_PULSES = 2;
	let glow = $state(0);
	let glowFrame = 0;

	function showGrip() {
		cancelAnimationFrame(glowFrame);
		const start = performance.now();
		const frame = (now: number) => {
			const t = (now - start) / GLOW_MS;
			glow = t < 1 ? Math.sin(Math.PI * GLOW_PULSES * t) ** 2 : 0;
			if (t < 1) glowFrame = requestAnimationFrame(frame);
		};
		glowFrame = requestAnimationFrame(frame);
	}

	function hideGrip() {
		cancelAnimationFrame(glowFrame);
		glow = 0;
	}

	$effect(() => {
		chain.glow(manual === 'fold' ? Math.floor(folds) : manual === 'tuck' ? 'lead' : null, glow);
		invalidate();
	});
	let startX = 0;
	let startY = 0;

	function toScreen(point: Vector3) {
		const { x, y } = point.clone().project(camera!);
		return new Vector2((x * $size.width) / 2, (-y * $size.height) / 2);
	}

	/** Works out what a drag starting on the paper at `hit` does, or nothing if it misses the paper. */
	function grab(): typeof dragValue | undefined {
		carrying = manual === 'carry';
		if (carrying) return hit.length() > RADIUS ? undefined : () => 0;

		if (manual === 'puff') {
			// pressing on or just outside a side and dragging to the middle pushes that side in
			if (hit.length() > RADIUS * 1.3) return;
			const turns = (Math.atan2(hit.y, hit.x) - STRIP_ANGLE) / (2 * Math.PI) - 0.25;
			dragSide = Math.floor((turns - Math.floor(turns)) * 5);
			const angle = STRIP_ANGLE + ((126 + 72 * dragSide) * Math.PI) / 180;
			const apothem = RADIUS * Math.cos(Math.PI / 5);
			const middle = new Vector3(apothem * Math.cos(angle), apothem * Math.sin(angle), 0);
			const inward = toScreen(new Vector3()).sub(toScreen(middle));
			const pixels = Math.max(inward.length() * PINCH, MIN_DRAG_PX);
			inward.normalize();
			const start = puff[dragSide];
			return (dx, dy) =>
				Math.min(Math.max(start + (dx * inward.x + dy * inward.y) / pixels, 0), 1);
		}

		const index = Math.floor(folds);
		const { frame, crease, loose } = chain.crease(manual === 'tuck' ? 'lead' : index);
		const [[x0, y0], [x1, y1]] = crease;
		chain.root.updateWorldMatrix(true, true);
		frame.worldToLocal(local.copy(hit));

		// a small strip on screen is still easy to catch
		const margin = (12 * hit.distanceTo(camera!.position)) / $size.height;
		const length = Math.hypot(x1 - x0, y1 - y0);
		outward.set(((y1 - y0) / length) * loose, (-(x1 - x0) / length) * loose, 0);
		const distance = (local.x - x0) * outward.x + (local.y - y0) * outward.y;
		const inside =
			distance > 0 &&
			local.y > -margin &&
			local.y < 1 + margin &&
			local.x > -margin &&
			local.x < VISIBLE_END + margin;
		if (!inside) return;

		// the drag is measured on screen as it was when grabbed, as folding moves the camera
		const reach = Math.min(Math.max(distance, GRIP[0]), GRIP[1]);
		const foot = frame.localToWorld(local.clone().addScaledVector(outward, -distance));
		const held = frame.localToWorld(local.clone().addScaledVector(outward, reach - distance));
		const span = toScreen(held).sub(toScreen(foot));
		const pixels = Math.max(span.length(), MIN_DRAG_PX);
		span.normalize();

		const base = manual === 'tuck' ? 0 : index;
		return (dx, dy) => {
			const side = Math.min(Math.max(1 + (dx * span.x + dy * span.y) / pixels, -1), 1);
			return base + Math.acos(side) / Math.PI;
		};
	}

	function onpointerdown(event: PointerEvent) {
		if (!manual || !camera || !controls || dragging || !event.isPrimary || event.button !== 0) return;
		pressed = { x: event.clientX, y: event.clientY };
		// the finished star is carried, not folded
		if (manual !== 'carry') holdTimer = setTimeout(startHold, HOLD_MS);
		const value = aim(event) ? grab() : undefined;
		if (!value) {
			missed = { x: event.clientX, y: event.clientY };
			return;
		}

		hideGrip();
		dragValue = value;
		startX = event.clientX;
		startY = event.clientY;
		dragging = true;
		view.style.cursor = 'grabbing';
		// this runs before the controls see the event, so a touch folds instead of orbiting
		controls.enabled = false;
	}

	/** Points `hit` at where on the paper's plane the pointer is; false if it is not over the plane. */
	function aim(event: PointerEvent) {
		const bounds = view.getBoundingClientRect();
		pointer.set(
			((event.clientX - bounds.left) / bounds.width) * 2 - 1,
			1 - ((event.clientY - bounds.top) / bounds.height) * 2
		);
		raycaster.setFromCamera(pointer, camera!);
		return raycaster.ray.intersectPlane(PAPER_PLANE, hit) !== null;
	}

	/** Shows a hand over the paper that can be dragged. */
	function hover(event: PointerEvent) {
		if (dragging || event.buttons) return;
		const over =
			manual && camera && view.contains(event.target as Node) && aim(event) && grab() !== undefined;
		view.style.cursor = over ? 'grab' : '';
	}

	function onpointermove(event: PointerEvent) {
		if (!event.isPrimary) return;
		if (pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >= CLICK_PX) {
			clearTimeout(holdTimer);
		}
		if (missed && Math.hypot(event.clientX - missed.x, event.clientY - missed.y) >= CLICK_PX) {
			missed = null;
			showGrip();
		}
		hover(event);
		if (!dragging) return;
		if (carrying) oncarry?.(event.clientX, event.clientY, false);
		else ondrag?.(dragValue(event.clientX - startX, event.clientY - startY), dragSide);
	}

	function onpointerup(event: PointerEvent) {
		if (!event.isPrimary) return;
		clearTimeout(holdTimer);
		if (holding) {
			holding = false;
			pressed = missed = null;
			if (controls) controls.enabled = true;
			onhold?.(false);
			return;
		}
		const clicked =
			pressed !== null &&
			Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < CLICK_PX;
		pressed = null;
		missed = null;
		if (dragging) {
			dragging = false;
			if (controls) controls.enabled = true;
			if (carrying) oncarry?.(event.clientX, event.clientY, true);
			else if (!clicked) onrelease?.();
			view.style.cursor = '';
		}
		if (clicked) onstep?.();
	}

	function onpointercancel(event: PointerEvent) {
		pressed = null;
		onpointerup(event);
	}

	view.addEventListener('pointerdown', onpointerdown);

	onDestroy(() => {
		view.removeEventListener('pointerdown', onpointerdown);
		clearTimeout(holdTimer);
		cancelAnimationFrame(glowFrame);
		chain.dispose();
		stripTexture.dispose();
		starTexture.dispose();
		geometry.dispose();
	});
</script>

<svelte:window {onpointermove} {onpointerup} {onpointercancel} />

<T.PerspectiveCamera makeDefault position={VIEW.toArray()} fov={FOV} far={400} bind:ref={camera}>
	<OrbitControls
		bind:ref={controls}
		enableDamping
		enablePan={false}
		mouseButtons={MOUSE_BUTTONS}
		autoRotate={spin}
		autoRotateSpeed={2}
	/>
</T.PerspectiveCamera>

<T.AmbientLight intensity={1.7} />
<T.DirectionalLight position={[3, 5, 6]} intensity={1.6} />
<T.DirectionalLight position={[-4, -2, -5]} intensity={1.2} />

<T is={chain.root} visible={!finished} />

<T.Mesh {geometry} rotation.z={STRIP_ANGLE} visible={finished}>
	<T.MeshStandardMaterial
		map={starTexture}
		roughness={0.85}
		emissive={GLOW_COLOR}
		emissiveIntensity={manual === 'puff' || manual === 'carry' ? glow * GLOW_STRENGTH : 0}
	/>
</T.Mesh>
