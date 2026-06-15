import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	buildGuillocheImage,
	GUILLOCHE_DEFAULTS,
	serializeGuillocheImage,
} from "./render-guilloche.ts";

// buildGuillocheImage/serializeGuillocheImage must be PURE: they return the data
// URI and its source text and write no file. Importing this module must NOT write
// src/lib/guilloche-image.ts — the writeFileSync is guarded by import.meta.main.
// This mirrors the sitemap.ts purity invariant.
const IMAGE_PATH = join(
	import.meta.dirname,
	"..",
	"src",
	"lib",
	"guilloche-image.ts",
);
const existedBefore = existsSync(IMAGE_PATH);

afterAll(() => {
	if (!existedBefore && existsSync(IMAGE_PATH)) {
		rmSync(IMAGE_PATH);
	}
});

describe("guilloché finish generator", () => {
	it("importing the module writes no file (purity invariant)", () => {
		// Arrange + Act: the import at the top of this file already ran.
		// Assert: no guilloche-image.ts was created by importing the builder.
		expect(existsSync(IMAGE_PATH)).toBe(existedBefore);
	});

	it("buildGuillocheImage returns a data URI", () => {
		// Act
		const uri = buildGuillocheImage(GUILLOCHE_DEFAULTS);

		// Assert: a renderable <image href> target — an inline image data URI.
		expect(uri.startsWith("data:image/")).toBe(true);
		// The base64 payload is non-trivial (a real engraved field, not an empty SVG).
		expect(uri.length).toBeGreaterThan(500);
	});

	it("the renderer is deterministic for equal params", () => {
		// Act: same params twice.
		const a = buildGuillocheImage(GUILLOCHE_DEFAULTS);
		const b = buildGuillocheImage(GUILLOCHE_DEFAULTS);

		// Assert: a prebake must be reproducible so the committed literal is stable.
		expect(a).toBe(b);
	});

	it("serializeGuillocheImage emits Biome-clean TS exporting GUILLOCHE_IMAGE", () => {
		// Act
		const text = serializeGuillocheImage(
			buildGuillocheImage(GUILLOCHE_DEFAULTS),
		);

		// Assert: the literal dial.ts imports, newline-terminated.
		expect(text).toContain("export const GUILLOCHE_IMAGE");
		expect(text).toContain("data:image/");
		expect(text.endsWith("\n")).toBe(true);
	});
});
