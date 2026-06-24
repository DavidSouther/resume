// Project guard (Astrolabe FCC refactor): every DOM interaction in the dial
// render pipeline must flow through Jiffies. NO raw DOM mutation call may survive
// in the in-scope dial modules. This is the high-level source-scan guard from the
// project design — one of the project's executable acceptance artifacts, written
// alongside the qualitative Closing Bell.
//
// Scope (Feature 1 — dial render pipeline): every `.ts` in
// src/components/astrolabe/ EXCEPT test files, the bootstrap module (client.ts —
// window/visualViewport listeners and host-element sizing are permitted, revisited
// in Feature 2), and controls.ts (Feature 2 widens the scan to controls.ts +
// pages/astrolabe/page.ts). New dial modules (e.g. view.ts) are picked up
// automatically by the directory scan. (The shared test-dom helper lives one
// level up in src/components/, so it is never seen by this directory scan.)
//
// RED today: animation.ts/planets.ts/zodiac.ts/texture.ts/guilloche.ts are full of
// setAttribute / appendChild / createElementNS / classList / .style. / innerHTML /
// textContent= calls. GREEN when the dial is rebuilt as a pure simulate() -> Scene
// feeding an FCC tree. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = import.meta.dirname;

// Files in the component dir that are NOT part of the guarded set. client.ts
// stays excluded — its window/visualViewport listeners are permitted
// page-lifecycle wiring and its sizeDial writes target the <svg> host element,
// not a dial descendant (see design, Deferred decisions). Feature 2 widens the
// scan: controls.ts joins the set, and pages/astrolabe/page.ts is appended
// explicitly (it lives outside this directory).
const EXCLUDE = new Set(["client.ts"]);

// Extra in-scope files outside this directory (Feature 2). Resolved relative to
// the repo root, which is two levels above this src/components/astrolabe dir.
const EXTRA_FILES = [
	join(DIR, "..", "..", "..", "pages", "astrolabe", "page.ts"),
];

function dialModules(): string[] {
	const dir = readdirSync(DIR)
		.filter((f) => f.endsWith(".ts"))
		.filter((f) => !/\.test\.ts$/.test(f))
		.filter((f) => !EXCLUDE.has(f))
		.map((f) => join(DIR, f));
	return [...dir, ...EXTRA_FILES].sort();
}

// Forbidden raw-DOM mutation call sites, written as method-call syntax so prose
// mentions of the API name do not trip the scan. The sanctioned replacement for
// each is a Jiffies builder / el.update() attr: children via the builder's child
// list, attributes via attr keys, events via `events:`, classes via `class`
// ("!x" removes), styles via the `style` attr, text via a text-node child.
const FORBIDDEN: { name: string; pattern: RegExp }[] = [
	{ name: "appendChild", pattern: /\.appendChild\s*\(/ },
	{ name: "insertBefore", pattern: /\.insertBefore\s*\(/ },
	{ name: "removeChild", pattern: /\.removeChild\s*\(/ },
	{ name: "replaceChild", pattern: /\.replaceChild\s*\(/ },
	{ name: "createElement(NS)", pattern: /\.createElement(NS)?\s*\(/ },
	{ name: "setAttribute", pattern: /\.setAttribute\s*\(/ },
	{ name: "removeAttribute", pattern: /\.removeAttribute\s*\(/ },
	{ name: "toggleAttribute", pattern: /\.toggleAttribute\s*\(/ },
	{ name: "classList", pattern: /\.classList\b/ },
	{ name: "innerHTML", pattern: /\.innerHTML\b/ },
	{ name: "outerHTML", pattern: /\.outerHTML\b/ },
	{ name: "textContent assignment", pattern: /\.textContent\s*=(?!=)/ },
	{ name: "dataset", pattern: /\.dataset\./ },
	{ name: "style", pattern: /\.style\b/ },
];

// addEventListener/removeEventListener are forbidden on elements (use `events:`),
// but permitted on window/document/globalThis/visualViewport (page-level
// lifecycle wiring, not FCC subtree wiring). Strip the permitted receivers first,
// then any remaining listener call is a failure.
const LISTENER = /\.(?:add|remove)EventListener\s*\(/;
const PERMITTED_LISTENER =
	/\b(?:window|document|globalThis|visualViewport)\.(?:add|remove)EventListener\s*\(/g;

describe("astrolabe dial render pipeline — no raw DOM (every interaction via Jiffies)", () => {
	const modules = dialModules();

	it("scans at least the known dial render modules", () => {
		// Guard the guard: if the scan list silently empties (e.g. a bad exclude),
		// the suite must not vacuously pass.
		expect(modules.length).toBeGreaterThanOrEqual(4);
	});

	for (const file of modules) {
		it(`${basename(file)} contains no forbidden raw-DOM mutation calls`, () => {
			const src = readFileSync(file, "utf-8");
			const hits: string[] = [];
			for (const { name, pattern } of FORBIDDEN) {
				if (pattern.test(src)) hits.push(name);
			}
			const withoutPermitted = src.replace(PERMITTED_LISTENER, "");
			if (LISTENER.test(withoutPermitted)) hits.push("addEventListener");
			expect(
				hits,
				`${basename(file)} must route ${hits.join(", ")} through Jiffies`,
			).toEqual([]);
		});
	}
});
