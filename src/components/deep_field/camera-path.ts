export const ORBIT_MAX = Math.PI / 2;
export const ZOOM_SPEED = 0.9;
export const OBLIQUE_ZOOM_TICKS = 2;
// Telescope-to-endpoint travel takes 18.75 s regardless of frame rate.
export const ORBIT_LEG_MS = 18_750;
// Pyramid with zero stretch puts the pivot at the telescope itself.
export const orbitRadius = (mid: number) => Math.max(1e-6, -mid);

export type Point = [number, number, number];
export interface CameraPose {
	az: number;
	el: number;
	radius: number;
}

// OrbitControls r128 uses 0.95 ** zoomSpeed as its wheel zoom scale.
export const zoomOut = (ticks: number) => 0.95 ** (-ZOOM_SPEED * ticks);

export function obliquePose(side: number, radius: number): CameraPose {
	return {
		az: side * ORBIT_MAX * 0.8,
		el: ORBIT_MAX * 0.6,
		radius: Math.max(1e-6, radius) * zoomOut(OBLIQUE_ZOOM_TICKS),
	};
}

export function orbitPose(s: number, radius: number): CameraPose {
	radius = Math.max(1e-6, radius);
	const end = obliquePose(1, radius);
	const endRadius = end.radius * zoomOut(4);
	const x = s * endRadius * Math.sin(end.az) * Math.cos(end.el);
	const y = s * s * endRadius * Math.sin(end.el);
	const r = radius * zoomOut((OBLIQUE_ZOOM_TICKS + 4) * s * s);
	// A parabola in world XY gives two raised endpoints and a level tangent at
	// the telescope. Changing distance along it adds the outward dolly.
	return {
		az: Math.atan2(x, Math.sqrt(Math.max(0, r * r - x * x - y * y))),
		el: Math.asin(y / r),
		radius: r,
	};
}

export function cameraPosition(pose: CameraPose, target: Point): Point {
	const { az, el, radius: r } = pose;
	return [
		target[0] + r * Math.sin(az) * Math.cos(el),
		target[1] + r * Math.sin(el),
		target[2] + r * Math.cos(az) * Math.cos(el),
	];
}

export function nearestOrbitSide(pose: CameraPose, target: Point): -1 | 1 {
	// The endpoints differ only in x, so the camera's x chooses the nearer one,
	// including when the user has panned away from the volume's centre.
	return cameraPosition(pose, target)[0] < 0 ? -1 : 1;
}

export function orbitStart(
	pose: CameraPose,
	target: Point,
	now: number,
	mid = target[2],
) {
	const radius = orbitRadius(mid);
	return {
		pose: { ...pose },
		target: [...target] as Point,
		mid,
		radius,
		now,
		side: nearestOrbitSide(pose, target),
		atTelescope:
			Math.abs(pose.az) < 1e-6 &&
			Math.abs(pose.el) < 1e-6 &&
			Math.abs(pose.radius - radius) < 1e-6 &&
			Math.hypot(target[0], target[1], target[2] - mid) < 1e-6,
	};
}

export type OrbitPath = ReturnType<typeof orbitStart>;

export function orbitStep(path: OrbitPath, now: number) {
	const t = Math.max(0, (now - path.now) / ORBIT_LEG_MS);
	const target: Point = [0, 0, path.mid];
	if (t < 1 && !path.atTelescope) {
		const e = t * t * (3 - 2 * t);
		const end = orbitPose(path.side, path.radius);
		const lerp = (a: number, b: number) => a + (b - a) * e;
		return {
			pose: {
				az: lerp(path.pose.az, end.az),
				el: lerp(path.pose.el, end.el),
				radius: lerp(path.pose.radius, end.radius),
			},
			target: path.target.map((v, i) => lerp(v, target[i])) as Point,
		};
	}
	const s =
		path.side *
		(t < 1
			? Math.sin((Math.PI / 2) * t * t * (3 - 2 * t))
			: Math.cos((Math.PI / 2) * (t - 1)));
	return { pose: orbitPose(s, path.radius), target };
}
