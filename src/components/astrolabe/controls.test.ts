// @vitest-environment jsdom
//
// Unit test for the F1 controls registry (Contract 2). The feature test
// (shell.feature.test.ts block B) already covers the always-visible/#debug
// happy path; this suite focuses on the registry edges the feature test does
// not exercise: id-idempotency (replace in place), Node[] fragment append, and
// registration-order preservation.
//
// The registry is module-level state shared across every test in the process,
// so each case uses its OWN distinct ids and asserts on the presence/order of
// those ids rather than on the total section count.
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import {
	CONTROLS_HOST_ATTR,
	ControlsHost,
	ControlsSheet,
	refreshControlsHost,
	registerControlsSection,
} from "./controls.ts";

afterEach(() => {
	window.location.hash = "";
	resetDom();
});

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

describe("controls registry", () => {
	it("replaces a section in place when an id is re-registered", () => {
		registerControlsSection({
			id: "dup",
			title: "Replace First",
			render: () => document.createTextNode("first-body"),
			debugOnly: false,
		});
		registerControlsSection({
			id: "dup",
			title: "Replace Second",
			render: () => document.createTextNode("second-body"),
			debugOnly: false,
		});

		const text = mount(ControlsSheet()).textContent ?? "";
		expect(occurrences(text, "Replace Second")).toBe(1);
		expect(text).not.toContain("Replace First");
	});

	it("appends every node when render returns a Node array", () => {
		registerControlsSection({
			id: "fragment",
			title: "Fragment Title",
			render: () => [
				document.createTextNode("frag-alpha"),
				document.createTextNode("frag-beta"),
			],
			debugOnly: false,
		});

		const text = mount(ControlsSheet()).textContent ?? "";
		expect(text).toContain("frag-alpha");
		expect(text).toContain("frag-beta");
	});

	it("renders sections in registration order", () => {
		registerControlsSection({
			id: "order-early",
			title: "Order Early",
			render: () => document.createTextNode("e"),
			debugOnly: false,
		});
		registerControlsSection({
			id: "order-late",
			title: "Order Late",
			render: () => document.createTextNode("l"),
			debugOnly: false,
		});

		const text = mount(ControlsSheet()).textContent ?? "";
		expect(text.indexOf("Order Early")).toBeLessThan(
			text.indexOf("Order Late"),
		);
	});

	it("gates a debugOnly section behind the #debug hash", () => {
		registerControlsSection({
			id: "gate-debug",
			title: "Gate Debug Title",
			render: () => document.createTextNode("gate-body"),
			debugOnly: true,
		});

		window.location.hash = "";
		expect(mount(ControlsSheet()).textContent ?? "").not.toContain(
			"Gate Debug Title",
		);

		window.location.hash = "#debug";
		expect(mount(ControlsSheet()).textContent ?? "").toContain(
			"Gate Debug Title",
		);
	});
});

// The static page bakes the sheet at the build-time hash (""); a real reader at
// /astrolabe/#debug needs the host re-rendered client-side. refreshControlsHost
// is the function the client toggle calls on hashchange — re-deciding the gating
// live. This guards the SSG-to-browser path the feature test (which renders in
// jsdom after setting the hash) cannot exercise.
describe("ControlsHost / refreshControlsHost", () => {
	it("re-renders the host to reveal a debugOnly section when the hash flips to #debug", () => {
		registerControlsSection({
			id: "host-debug",
			title: "Host Debug Title",
			render: () => document.createTextNode("host-debug-body"),
			debugOnly: true,
		});

		// Build-time render: no hash, so the debugOnly section is absent (mirrors
		// what the SSG bakes into the static HTML).
		window.location.hash = "";
		const host = mount(ControlsHost()).querySelector(`[${CONTROLS_HOST_ATTR}]`);
		expect(host).not.toBeNull();
		expect(host?.textContent ?? "").not.toContain("Host Debug Title");

		// Reader navigates to #debug; the client toggle re-renders the same host.
		window.location.hash = "#debug";
		refreshControlsHost(host as Element);
		expect(host?.textContent ?? "").toContain("Host Debug Title");

		// And back: leaving #debug hides it again, with no duplicate sheets.
		window.location.hash = "";
		refreshControlsHost(host as Element);
		expect(host?.textContent ?? "").not.toContain("Host Debug Title");
	});
});
