// @vitest-environment jsdom
//
// FEATURE TEST — F1: Astrolabe Shell & Case (design.md 2026-06-14-B).
//
// User story (Given/When/Then):
//   GIVEN a reader opens /astrolabe/ cold,
//   WHEN the Astrolabe shell renders,
//   THEN they see a portrait watch — an HTML <figure> framing a PLATINUM CASE
//        that wraps a single EMPTY DIAL CONTAINER (the slot F2 fills at the
//        coordinate contract: NO <svg>, NO [data-body] groups yet) — with an
//        ALWAYS-VISIBLE CONTROLS SHEET present below the case.
//   AND the controls sheet is built from F1's contributed-section REGISTRY
//        (Contract 2): registering a section makes it appear, and a debugOnly
//        section is gated behind the #debug URL hash.
//
// This test stays RED until F1 is built — it encodes the END STATE. It fails
// for the RIGHT reason at the start: the modules under src/components/astrolabe/
// do not exist yet (missing component), not a syntax error.
//
// Truly visual/motion behavior (portrait fill on a phone, platinum/cordovan
// finish, square aspect, live token repaint) is browser-verified in a later
// step, not unit-tested here. This test is jsdom-friendly and structural.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import { Astrolabe } from "./astrolabe.ts";
import { ControlsSheet, registerControlsSection } from "./controls.ts";

beforeEach(() => {
	// Default to a clean (no #debug) location so the always-visible vs debugOnly
	// distinction is exercised deterministically.
	window.location.hash = "";
});
afterEach(resetDom);

describe("F1 astrolabe shell renders the empty watch and the controls registry", () => {
	it("renders a portrait <figure> framing a single empty dial container, with no astronomy", () => {
		// Arrange + Act: render the F1 shell (case/strap + empty dial + controls).
		const container = mount(Astrolabe());

		// 1. Portrait watch wrapper is an HTML <figure>.
		const figure = container.querySelector("figure");
		expect(figure).not.toBeNull();

		// 2. Exactly one empty dial container exists — the slot F2 mounts its
		//    <svg viewBox="-500 -500 1000 1000"> into. It carries the stable hook
		//    F2 targets and is currently EMPTY of dial content.
		const dials = container.querySelectorAll("[data-astrolabe-dial]");
		expect(dials.length).toBe(1);
		const dial = dials[0];

		// 3. F2 has filled the slot (the contracted hand-off): the dial host now
		//    holds the populated <svg> and its [data-body] body groups. This is the
		//    single F1-test assertion F2 flips — from "empty slot" to "populated".
		expect(dial.querySelector("svg")).not.toBeNull();
		expect(dial.querySelector("[data-body]")).not.toBeNull();
		expect(container.querySelector("[data-body]")).not.toBeNull();

		// 4. F3 has added the Realtime/Fast button to the composed Astrolabe (the
		//    design records this expected feature-progression flip: F1 shipped no
		//    such button; F3 mounts it onto the case, outside the controls sheet).
		const buttonText = Array.from(container.querySelectorAll("button"), (b) =>
			(b.textContent ?? "").toLowerCase(),
		).join(" ");
		expect(buttonText).toMatch(/realtime|fast/);
	});

	it("builds the always-visible controls sheet from the contributed-section registry, gating debugOnly behind #debug", () => {
		// Arrange: contribute one always-visible and one debugOnly section through
		// the F1 registry (Contract 2). Idempotent on id, so re-running is safe.
		registerControlsSection({
			id: "test-always",
			title: "Always Section",
			render: () => document.createTextNode("always-body"),
			debugOnly: false,
		});
		registerControlsSection({
			id: "test-debug",
			title: "Debug Section",
			render: () => document.createTextNode("debug-body"),
			debugOnly: true,
		});

		// Act 1: no #debug hash — only the always-visible section shows.
		window.location.hash = "";
		const plain = mount(ControlsSheet());
		expect(plain.textContent ?? "").toContain("Always Section");
		expect(plain.textContent ?? "").not.toContain("Debug Section");

		// Act 2: with the #debug hash — the debugOnly section appears too.
		window.location.hash = "#debug";
		const debug = mount(ControlsSheet());
		expect(debug.textContent ?? "").toContain("Always Section");
		expect(debug.textContent ?? "").toContain("Debug Section");
	});
});
