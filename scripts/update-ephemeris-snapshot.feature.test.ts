import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	type AstroSnapshot,
	buildSnapshot,
	serializeSnapshot,
} from "./update-ephemeris-snapshot.ts";

// buildSnapshot/serializeSnapshot must be PURE: they return the snapshot and its
// source text and write no file. Importing this module must NOT write
// src/lib/astro-snapshot.ts — the writeFileSync is guarded to run only when the
// script is the entry point (import.meta.main). This mirrors the sitemap.ts
// purity invariant.
const SNAPSHOT_PATH = join(
	import.meta.dirname,
	"..",
	"src",
	"lib",
	"astro-snapshot.ts",
);
const existedBefore = existsSync(SNAPSHOT_PATH);

afterAll(() => {
	// If the import accidentally created the file, clean it up so the suite leaves
	// no artifact. (A real generated snapshot from a build is left alone.)
	if (!existedBefore && existsSync(SNAPSHOT_PATH)) {
		rmSync(SNAPSHOT_PATH);
	}
});

// The ten bodies a complete snapshot must carry.
const BODIES = [
	"sun",
	"mercury",
	"venus",
	"earth",
	"moon",
	"mars",
	"jupiter",
	"saturn",
	"uranus",
	"neptune",
];

describe("ephemeris snapshot generator", () => {
	it("importing the module writes no file (purity invariant)", () => {
		// Arrange + Act: the import at the top of this file already ran.
		// Assert: no astro-snapshot.ts was created by importing the builder.
		expect(existsSync(SNAPSHOT_PATH)).toBe(existedBefore);
	});

	it("buildSnapshot returns positions for all ten bodies and an ISO date", () => {
		// Act
		const snap: AstroSnapshot = buildSnapshot(new Date("2026-06-14T00:00:00Z"));

		// Assert: an ISO calendar date (YYYY-MM-DD).
		expect(snap.date).toBe("2026-06-14");
		// Assert: every body is present exactly once.
		const bodies = snap.positions.map((p) => p.body).sort();
		expect(bodies).toEqual([...BODIES].sort());
	});

	it("serializeSnapshot emits Biome-clean TS exporting ASTRO_SNAPSHOT", () => {
		// Act
		const text = serializeSnapshot(
			buildSnapshot(new Date("2026-06-14T00:00:00Z")),
		);

		// Assert: the literal the dial's import chain pulls in, tab-indented and
		// newline-terminated so `npm run check` lints it clean.
		expect(text).toContain("export const ASTRO_SNAPSHOT");
		expect(text).toContain("satisfies AstroSnapshot");
		expect(text.endsWith("\n")).toBe(true);
		expect(text).not.toContain("    "); // no space indentation; TABS only
	});
});
