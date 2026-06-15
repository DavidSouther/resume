// @vitest-environment jsdom
//
// Unit test for the F1 client toggle (controls-client.ts). This is the browser
// path the feature test cannot reach: the static page bakes the sheet at the
// build-time hash, and only this client script re-renders it from the live URL
// hash. We assert the observable behavior — after startControlsClient, the host
// reflects the current hash, and a hashchange to/from #debug toggles F1's
// material panel — not which functions were called.
//
// NOTE: importing the module runs its top-level startControlsClient() once (the
// production entry behavior). The tests below re-run it explicitly to exercise a
// freshly-mounted host; startControlsClient is idempotent on the registry id and
// safe to call repeatedly.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONTROLS_HOST_ATTR, ControlsHost } from "./controls.ts";
import { startControlsClient, syncControlsHost } from "./controls-client.ts";

beforeEach(() => {
	window.location.hash = "";
});
afterEach(() => {
	window.location.hash = "";
	document.body.innerHTML = "";
});

describe("controls client toggle", () => {
	it("reveals the F1 material panel when the host syncs under #debug", () => {
		// The SSG-equivalent host: built at the no-hash build time, so its baked
		// contents omit the debugOnly material section.
		window.location.hash = "";
		const host = ControlsHost();
		document.body.append(host);

		startControlsClient();
		// "Case & Strap" is materialSection.title — debugOnly, absent without #debug.
		expect(host.textContent ?? "").not.toContain("Case & Strap");

		window.location.hash = "#debug";
		syncControlsHost();
		expect(host.textContent ?? "").toContain("Case & Strap");
	});

	it("toggles the panel back off when the hash leaves #debug", () => {
		window.location.hash = "#debug";
		const host = ControlsHost();
		document.body.append(host);

		startControlsClient();
		expect(host.textContent ?? "").toContain("Case & Strap");

		window.location.hash = "";
		syncControlsHost();
		expect(host.textContent ?? "").not.toContain("Case & Strap");
	});

	it("is a no-op when no controls host is present", () => {
		expect(document.querySelector(`[${CONTROLS_HOST_ATTR}]`)).toBeNull();
		expect(() => syncControlsHost()).not.toThrow();
	});
});
