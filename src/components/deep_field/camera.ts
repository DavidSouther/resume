// Camera views, resize, billboard tilt and the render loop.
import { initPicking, select, updateOverlays } from "./picking.ts";
import {
	anim,
	BILLBOARD_MAX,
	camera,
	controls,
	flyTo,
	ORBIT_MAX,
	renderer,
	scene,
	stage,
	volumeMid,
} from "./rig.ts";
import { spriteMeshes } from "./scene.ts";
import { $, D_NEAR, H0W, hooks, view } from "./state.ts";

export function viewHome(animate = true) {
	flyTo([0, 0, 0], [0, 0, volumeMid()], animate);
}
// camera on a sphere about the volume midpoint, at the home distance
function orbitView(az: number, el: number) {
	const m = volumeMid();
	const r = -m;
	const ce = Math.cos(el);
	flyTo(
		[r * Math.sin(az) * ce, r * Math.sin(el), m + r * Math.cos(az) * ce],
		[0, 0, m],
	);
}

export function resize() {
	const w = stage.clientWidth;
	const h = stage.clientHeight;
	if (!w || !h) return;
	renderer.setSize(w, h, false);
	camera.aspect = w / h;
	// frame the whole photograph from the telescope position
	const halfH = Math.max(H0W / 2, view.W0 / 2 / camera.aspect) * 1.04;
	camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / D_NEAR));
	camera.updateProjectionMatrix();
}

// quads follow the camera at BILLBOARD_MAX / ORBIT_MAX of its offset, reaching BILLBOARD_MAX at the orbit limit
function updateTilt() {
	const k = BILLBOARD_MAX / ORBIT_MAX;
	const az = controls.getAzimuthalAngle();
	const el = Math.PI / 2 - controls.getPolarAngle();
	const c = (a: number) => Math.max(-ORBIT_MAX, Math.min(ORBIT_MAX, a)) * k;
	for (const m of spriteMeshes)
		m.material.uniforms.uTilt.value.set(c(az), c(el));
}

function frame(now: number) {
	if (anim.tween) anim.tween(now);
	if (controls.autoRotate) {
		const az = controls.getAzimuthalAngle();
		const sp = Math.abs(controls.autoRotateSpeed);
		if (az >= ORBIT_MAX - 0.01) controls.autoRotateSpeed = sp;
		else if (az <= -ORBIT_MAX + 0.01) controls.autoRotateSpeed = -sp;
	}
	controls.update();
	updateTilt();
	updateOverlays();
	renderer.render(scene, camera);
	requestAnimationFrame(frame);
}

export function initCamera() {
	hooks.afterBuild = () => {
		resize();
		viewHome(false);
	};
	$("vHome").onclick = () => viewHome();
	$("vSide").onclick = () => orbitView(ORBIT_MAX, 0);
	$("vTop").onclick = () => orbitView(0, ORBIT_MAX);
	$("vOblique").onclick = () => orbitView(ORBIT_MAX * 0.8, ORBIT_MAX * 0.6);
	$("vSpin").onclick = (e) => {
		controls.autoRotate = !controls.autoRotate;
		controls.autoRotateSpeed = 0.8;
		(e.currentTarget as HTMLElement).setAttribute(
			"aria-pressed",
			String(controls.autoRotate),
		);
	};
	window.addEventListener("keydown", (e) => {
		if ((e.target as HTMLElement).closest("input,select")) return;
		if (e.key === "h" || e.key === "H") viewHome();
		if (e.key === "Escape") select(null);
	});
	initPicking(() => {
		anim.tween = null;
	});
	new ResizeObserver(resize).observe(stage);
	resize();
	requestAnimationFrame(frame);
}
