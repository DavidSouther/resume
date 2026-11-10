// Camera views, resize, billboard tilt and the render loop.
import { billboardBasis } from "./billboard.ts";
import {
	cameraPosition,
	ORBIT_MAX,
	type OrbitPath,
	obliquePose,
	orbitRadius,
	orbitStart,
	orbitStep,
} from "./camera-path.ts";
import { initPicking, select, updateOverlays } from "./picking.ts";
import {
	anim,
	camera,
	controls,
	flyTo,
	reduceMotion,
	renderer,
	scene,
	stage,
	volumeMid,
} from "./rig.ts";
import { spriteMeshes } from "./scene.ts";
import { $, D_NEAR, H0W, hooks, view } from "./state.ts";

let orbit: OrbitPath | null = null;
let idleOrbit = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const pointersDown = new Set<number>();

function stopOrbit() {
	orbit = null;
	anim.tween = null;
	$("vSpin").setAttribute("aria-pressed", "false");
}

function startOrbit() {
	anim.tween = null;
	const target = controls.target.toArray() as [number, number, number];
	orbit = orbitStart(
		{
			az: controls.getAzimuthalAngle(),
			el: Math.PI / 2 - controls.getPolarAngle(),
			radius: camera.position.distanceTo(controls.target),
		},
		target,
		performance.now(),
		volumeMid(),
	);
	// Drain drag inertia before the path starts driving the camera itself.
	controls.enableDamping = false;
	controls.update();
	controls.enableDamping = true;
	$("vSpin").setAttribute("aria-pressed", "true");
}

function cancelIdleOrbit() {
	idleOrbit = false;
	if (idleTimer !== null) clearTimeout(idleTimer);
	idleTimer = null;
}

function delayIdleOrbit() {
	if (!idleOrbit) return;
	if (idleTimer !== null) clearTimeout(idleTimer);
	if (pointersDown.size) return;
	idleTimer = setTimeout(() => {
		cancelIdleOrbit();
		startOrbit();
	}, 2500);
}

export function viewHome(animate = true) {
	stopOrbit();
	flyTo([0, 0, 0], [0, 0, volumeMid()], animate);
}
// camera on a sphere about the volume midpoint, at the home distance
function orbitView(az: number, el: number) {
	stopOrbit();
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

function updateTilt() {
	const az = controls.getAzimuthalAngle();
	const el = Math.PI / 2 - controls.getPolarAngle();
	const [xx, xy, yx, yy] = billboardBasis(az, el);
	for (const m of spriteMeshes) {
		m.material.uniforms.uSpriteX.value.set(xx, xy);
		m.material.uniforms.uSpriteY.value.set(yx, yy);
	}
}

function frame(now: number) {
	if (anim.tween) anim.tween(now);
	if (orbit) {
		const mid = volumeMid();
		if (mid !== orbit.mid) {
			orbit.target[2] += mid - orbit.mid;
			const radius = orbitRadius(mid);
			orbit.pose.radius *= radius / orbit.radius;
			orbit.radius = radius;
			orbit.mid = mid;
		}
		const { pose, target } = orbitStep(orbit, now);
		camera.position.set(...cameraPosition(pose, target));
		controls.target.set(...target);
		view.pivotZ = mid;
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
		cancelIdleOrbit();
		idleOrbit = !reduceMotion;
		delayIdleOrbit();
	};
	$("vHome").onclick = () => viewHome();
	$("vSide").onclick = () => orbitView(ORBIT_MAX, 0);
	$("vTop").onclick = () => orbitView(0, ORBIT_MAX);
	$("vOblique").onclick = () => {
		stopOrbit();
		const mid = volumeMid();
		flyTo(cameraPosition(obliquePose(1, -mid), [0, 0, mid]), [0, 0, mid]);
	};
	$("vSpin").onclick = () => {
		cancelIdleOrbit();
		if (orbit) stopOrbit();
		else startOrbit();
	};
	controls.addEventListener("start", () => {
		stopOrbit();
		delayIdleOrbit();
	});
	for (const event of ["wheel", "keydown", "input", "change"])
		document.addEventListener(event, delayIdleOrbit, {
			capture: true,
			passive: true,
		});
	document.addEventListener(
		"pointerdown",
		(e) => {
			pointersDown.add(e.pointerId);
			delayIdleOrbit();
		},
		{ capture: true, passive: true },
	);
	for (const event of ["pointerup", "pointercancel"] as const)
		document.addEventListener(
			event,
			(e) => {
				pointersDown.delete(e.pointerId);
				delayIdleOrbit();
			},
			{ capture: true, passive: true },
		);
	window.addEventListener("keydown", (e) => {
		if ((e.target as HTMLElement).closest("input,select")) return;
		if (e.key === "h" || e.key === "H") viewHome();
		if (e.key === "Escape") select(null);
	});
	initPicking(() => {
		stopOrbit();
	});
	new ResizeObserver(resize).observe(stage);
	resize();
	requestAnimationFrame(frame);
}
