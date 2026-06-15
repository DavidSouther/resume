// @vitest-environment jsdom
//
// Functional suite for the always-visible render-mode switch (F3, Step 3). One
// functional test class (the parsimony ceiling): the section renders a
// geocentric/orbital switch, selecting a tab writes the watch-root attribute,
// and currentRenderMode reads it back (defaulting to geocentric).
//
// The Earth-release transform itself is browser-verified (design §Summary), not
// asserted here; this suite covers the section's structure and the attribute
// round-trip the motion engine (Step 5) reads.
import { div } from "@davidsouther/jiffies/dom/html.ts";
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import {
	currentRenderMode,
	RENDER_MODE_ATTR,
	renderModeSection,
} from "./render-mode.ts";

afterEach(resetDom);

/** Mount the section inside a real `.astrolabe` watch root, returning both. */
function mountInRoot(): { root: HTMLElement; section: HTMLElement } {
	const root = div({ class: "astrolabe" });
	const section = mount(renderModeSection.render());
	root.append(section);
	mount(root);
	return { root, section };
}

/** Select a render-mode radio by its id, dispatching the change the handler reads. */
function selectMode(host: ParentNode, id: string): void {
	const radio = host.querySelector(`input#${id}`) as HTMLInputElement;
	radio.checked = true;
	radio.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("renderModeSection is the always-visible geocentric/orbital switch", () => {
	it("is an always-visible (non-debug) section", () => {
		expect(renderModeSection.debugOnly).toBe(false);
		expect(renderModeSection.id).toBe("render-mode");
	});

	it("renders a switch carrying both geocentric and orbital labels", () => {
		const section = mount(renderModeSection.render());
		const text = (section.textContent ?? "").toLowerCase();
		expect(text).toMatch(/geocentric/);
		expect(text).toMatch(/orbital/);
	});

	it("defaults to geocentric when the root carries no attribute", () => {
		const root = div({ class: "astrolabe" });
		expect(currentRenderMode(root)).toBe("geocentric");
	});

	it("writes the orbital mode onto the watch root when Orbital is selected", () => {
		const { root, section } = mountInRoot();

		selectMode(section, "orbital");

		expect(root.getAttribute(RENDER_MODE_ATTR)).toBe("orbital");
		expect(currentRenderMode(root)).toBe("orbital");
	});

	it("restores geocentric on the watch root when Geocentric is reselected", () => {
		const { root, section } = mountInRoot();
		selectMode(section, "orbital");

		selectMode(section, "geocentric");

		expect(currentRenderMode(root)).toBe("geocentric");
	});
});
