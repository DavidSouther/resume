// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initCamera } from "./camera.ts";
import { cameraPosition, ORBIT_LEG_MS, orbitPose } from "./camera-path.ts";
import { camera, controls, flyTo, volumeMid } from "./rig.ts";
import { D_NEAR, H0W, hooks, view } from "./state.ts";

vi.mock("./picking.ts", () => ({
	initPicking: vi.fn(),
	updateOverlays: vi.fn(),
}));
vi.mock("./scene.ts", () => ({ spriteMeshes: [] }));
vi.mock("./rig.ts", () => {
	class Vector {
		x: number;
		y: number;
		z: number;
		constructor(x = 0, y = 0, z = 0) {
			this.x = x;
			this.y = y;
			this.z = z;
		}
		set(x: number, y: number, z: number) {
			Object.assign(this, { x, y, z });
		}
		toArray() {
			return [this.x, this.y, this.z];
		}
		distanceTo(v: Vector) {
			return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
		}
	}
	const camera = {
		position: new Vector(),
		aspect: 1,
		fov: 45,
		updateProjectionMatrix: vi.fn(),
	};
	const target = new Vector(0, 0, -1);
	return {
		anim: { tween: null },
		camera,
		controls: {
			target,
			getAzimuthalAngle: () =>
				Math.atan2(camera.position.x - target.x, camera.position.z - target.z),
			getPolarAngle: () =>
				Math.acos(
					(camera.position.y - target.y) / camera.position.distanceTo(target),
				),
			addEventListener: vi.fn(),
			update: vi.fn(),
		},
		flyTo: vi.fn((p: [number, number, number], t: [number, number, number]) => {
			camera.position.set(...p);
			target.set(...t);
		}),
		reduceMotion: false,
		renderer: { setSize: vi.fn(), render: vi.fn() },
		scene: {},
		stage: { clientWidth: 400, clientHeight: 400 },
		volumeMid: vi.fn(() => -1),
	};
});

const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
const orbiting = () => button("vSpin").getAttribute("aria-pressed") === "true";
function frame(now: number) {
	const callback = vi.mocked(requestAnimationFrame).mock.lastCall?.[0];
	callback?.(now);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	vi.mocked(volumeMid).mockReturnValue(-1);
	view.W0 = H0W;
	document.body.innerHTML = ["vHome", "vSide", "vTop", "vOblique", "vSpin"]
		.map((id) => `<button id="${id}"></button>`)
		.join("");
	vi.stubGlobal("THREE", {
		MathUtils: { radToDeg: (v: number) => (v * 180) / Math.PI },
	});
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
		},
	);
	vi.stubGlobal("requestAnimationFrame", vi.fn());
	initCamera();
	hooks.afterBuild();
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

it("frames the whole new image after its aspect ratio changes", () => {
	view.W0 = H0W * 16;
	hooks.afterBuild();
	const visibleWidth =
		2 * D_NEAR * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
	expect(visibleWidth).toBeGreaterThanOrEqual(view.W0);
});

it("begins orbit after 2.5 idle seconds for each loaded image, without restarting a stopped orbit", () => {
	vi.advanceTimersByTime(2499);
	expect(orbiting()).toBe(false);
	vi.advanceTimersByTime(1);
	expect(orbiting()).toBe(true);
	button("vSpin").click();
	vi.advanceTimersByTime(10_000);
	expect(orbiting()).toBe(false);
	hooks.afterBuild();
	vi.advanceTimersByTime(2500);
	expect(orbiting()).toBe(true);
});

it("postpones the fresh-image orbit until 2.5 seconds after the last interaction", () => {
	vi.advanceTimersByTime(2000);
	document.dispatchEvent(new WheelEvent("wheel"));
	vi.advanceTimersByTime(2499);
	expect(orbiting()).toBe(false);
	vi.advanceTimersByTime(1);
	expect(orbiting()).toBe(true);
});

it("waits for a held pointer to be released before counting idle time", () => {
	document.dispatchEvent(new MouseEvent("pointerdown"));
	vi.advanceTimersByTime(5000);
	expect(orbiting()).toBe(false);
	document.dispatchEvent(new MouseEvent("pointerup"));
	vi.advanceTimersByTime(2499);
	expect(orbiting()).toBe(false);
	vi.advanceTimersByTime(1);
	expect(orbiting()).toBe(true);
});

it("moves from a user rotation to the nearer raised endpoint, then through telescope to the other side", () => {
	camera.position.set(
		...cameraPosition({ az: -0.4, el: 0.2, radius: 1.2 }, [0, 0, -1]),
	);
	button("vSpin").click();
	const start = performance.now();
	frame(start + ORBIT_LEG_MS);
	expect(camera.position.x).toBeLessThan(0);
	expect(camera.position.y).toBeGreaterThan(0);
	frame(start + 2 * ORBIT_LEG_MS);
	expect(camera.position.x).toBeCloseTo(0);
	expect(camera.position.y).toBeCloseTo(0);
	expect(camera.position.z).toBeCloseTo(0);
	frame(start + 3 * ORBIT_LEG_MS);
	expect(camera.position.x).toBeGreaterThan(0);
	expect(camera.position.y).toBeGreaterThan(0);
});

it("makes Oblique a little wider and stops orbit when a preset is chosen", () => {
	button("vSpin").click();
	button("vOblique").click();
	expect(orbiting()).toBe(false);
	const call = vi.mocked(flyTo).mock.lastCall;
	if (!call) throw new Error("Preset did not move the camera");
	const [position, target] = call;
	const radius = Math.hypot(...position.map((v, i) => v - target[i]));
	expect(radius).toBeGreaterThan(1);
	expect(radius).toBeLessThan(orbitPose(1, 1).radius);
});

it("stops orbit when OrbitControls starts a drag or zoom", () => {
	button("vSpin").click();
	const listener = vi
		.mocked(controls.addEventListener)
		.mock.calls.find(([event]: [string]) => event === "start")?.[1];
	listener();
	expect(orbiting()).toBe(false);
	vi.advanceTimersByTime(10_000);
	expect(orbiting()).toBe(false);
});

it("keeps an active orbit centred when the depth parameters move its pivot", () => {
	button("vSpin").click();
	vi.mocked(volumeMid).mockReturnValue(-3);
	frame(performance.now() + ORBIT_LEG_MS);
	expect(controls.target.z).toBe(-3);
	expect(camera.position.distanceTo(controls.target)).toBeCloseTo(
		orbitPose(1, 3).radius,
	);
});

it("keeps the camera finite when a pyramid's depth reaches zero and grows again", () => {
	button("vSpin").click();
	vi.mocked(volumeMid).mockReturnValue(0);
	frame(performance.now() + ORBIT_LEG_MS);
	expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
	vi.mocked(volumeMid).mockReturnValue(-3);
	frame(performance.now() + 2 * ORBIT_LEG_MS);
	expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
	expect(controls.target.z).toBe(-3);
});
