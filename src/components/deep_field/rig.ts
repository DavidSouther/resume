// WebGL renderer, scene, camera and orbit controls, plus the camera pivot and
// fly-to helpers that every view shares.

import { ORBIT_MAX, ZOOM_SPEED } from "./camera-path.ts";
import { dNear, dOfU } from "./placement.ts";
import { $, css, P, view } from "./state.ts";

export const stage = $("stage");
export const renderer = new THREE.WebGLRenderer({
	antialias: true,
	alpha: false,
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(new THREE.Color(css("--df-void")));
stage.prepend(renderer.domElement);
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000);
export const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = ZOOM_SPEED;
// The camera may swing a quarter turn (90°) off the telescope axis in each
// direction, a half turn in all: it reaches the side and top views but never
// goes behind the field.
controls.minAzimuthAngle = -ORBIT_MAX;
controls.maxAzimuthAngle = ORBIT_MAX;
controls.minPolarAngle = Math.PI / 2 - ORBIT_MAX;
controls.maxPolarAngle = Math.PI / 2 + ORBIT_MAX;

export const reduceMotion = window.matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;
export const anim = { tween: null as ((now: number) => void) | null };

// Orbit pivot: a quarter of the way into a pyramid, where most of the field's
// area is nearest; halfway for frustum and box.
export function volumeMid(): number {
	const t = P.proj === "pyramid" ? 0.25 : 0.5;
	return -(dNear() + t * (dOfU(1) - dNear()));
}

// Home, Side, Top, Oblique and Orbit all pivot on volumeMid. When mode,
// stretch, curve or z ranges move it, slide the live pivot along z with it
// (keeping pans in x and y) so every view still turns about the same point.
export function syncPivot() {
	if (view.pivotZ === null) return;
	const m = volumeMid();
	if (m !== view.pivotZ) {
		controls.target.z += m - view.pivotZ;
		view.pivotZ = m;
	}
}

export function flyTo(
	pos: [number, number, number],
	target: [number, number, number],
	animate = true,
) {
	view.pivotZ = target[2];
	if (!animate || reduceMotion) {
		camera.position.set(...pos);
		controls.target.set(...target);
		controls.update();
		return;
	}
	const p0 = camera.position.clone();
	const t0 = controls.target.clone();
	const p1 = new THREE.Vector3(...pos);
	const t1 = new THREE.Vector3(...target);
	const start = performance.now();
	anim.tween = (now: number) => {
		const t = Math.min(1, (now - start) / 700);
		const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
		camera.position.lerpVectors(p0, p1, e);
		controls.target.lerpVectors(t0, t1, e);
		if (t >= 1) anim.tween = null;
	};
}
