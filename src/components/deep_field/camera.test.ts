// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { initCamera } from "./camera.ts";
import { camera } from "./rig.ts";
import { D_NEAR, H0W, hooks, view } from "./state.ts";

vi.mock("./picking.ts", () => ({ initPicking: vi.fn() }));
vi.mock("./scene.ts", () => ({ spriteMeshes: [] }));
vi.mock("./rig.ts", () => ({
	anim: {},
	BILLBOARD_MAX: 1 / 6,
	ORBIT_MAX: Math.PI / 2,
	camera: { aspect: 1, fov: 45, updateProjectionMatrix: vi.fn() },
	controls: {},
	flyTo: vi.fn(),
	renderer: { setSize: vi.fn() },
	scene: {},
	stage: { clientWidth: 400, clientHeight: 400 },
	volumeMid: () => -1,
}));

it("frames the whole new image after its aspect ratio changes", () => {
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
	view.W0 = H0W * 16;
	hooks.afterBuild();
	const visibleWidth =
		2 * D_NEAR * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
	expect(visibleWidth).toBeGreaterThanOrEqual(view.W0);
});
