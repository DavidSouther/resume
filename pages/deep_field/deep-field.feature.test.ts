import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import {
	type Field,
	matchCatalog,
} from "../../src/components/deep_field/catalog.ts";
import { skyToUnit } from "../../src/components/deep_field/wcs.ts";

// Feature: a visitor opens /deep_field/ and gets the Deep Field Volume page,
// whose detector is a Rust/WASM port that agrees with SEP on the bundled image.
//
// Given the built site (docs/ is built once by vitest's global setup),
// When the Deep Field page, its WASM detector and catalog fields are read,
// Then the page ships them, every offered image has a known orientation and
// catalog redshifts, the old static page is gone, the toolchain is pinned,
// and the detector finds the same sources as SEP on the sample image.

const ROOT = join(import.meta.dirname, "..", "..");
const DOCS = join(ROOT, "docs", "deep_field");
const WASM_DIR = join(ROOT, "public", "deep_field", "detect");
const SAMPLE = join(ROOT, "public", "deep_field", "potm2301a.png");
const ORACLE = join(
	ROOT,
	"pages",
	"deep_field",
	"detect",
	"oracle",
	"sep_oracle.py",
);

type Obj = {
	cx: number;
	cy: number;
	area: number;
	flux: number;
};

type Oracle = {
	width: number;
	height: number;
	luminance_b64: string;
	objects: Obj[];
};

// An object in `from` is matched when `to` holds one within 2 px whose area is
// within a factor of 1.4.
function matchedFraction(from: Obj[], to: Obj[]): number {
	if (from.length === 0) return 1;
	const hit = from.filter((a) =>
		to.some(
			(b) =>
				Math.hypot(a.cx - b.cx, a.cy - b.cy) <= 2 &&
				b.area / a.area <= 1.4 &&
				a.area / b.area <= 1.4,
		),
	);
	return hit.length / from.length;
}

async function compareWithSep(...args: string[]) {
	const run = spawnSync(
		"uv",
		[
			"run",
			"--with",
			"sep",
			"--with",
			"numpy",
			"--with",
			"pillow",
			"python",
			ORACLE,
			...args,
		],
		{ encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 },
	);
	expect(run.status, run.stderr).toBe(0);
	const sep = JSON.parse(run.stdout) as Oracle;

	// Load the built WASM in Node and run only the core on the same luminance.
	const glue = join(WASM_DIR, "detect.js");
	const mod = (await import(pathToFileURL(glue).href)) as {
		initSync: (arg: { module: Uint8Array }) => void;
		detect_core: (lum: Float32Array, w: number, h: number) => Obj[];
	};
	mod.initSync({ module: readFileSync(join(WASM_DIR, "detect_bg.wasm")) });
	const bytes = Buffer.from(sep.luminance_b64, "base64");
	const lum = new Float32Array(
		bytes.buffer,
		bytes.byteOffset,
		sep.width * sep.height,
	);
	const rust = mod.detect_core(lum, sep.width, sep.height);

	return { sep, rust };
}

describe("Deep Field Volume page", () => {
	it("ships the page, WASM detector and catalog fields", () => {
		// The page is built from pages/deep_field and the old static copy is gone.
		const html = readFileSync(join(DOCS, "index.html"), "utf-8");
		expect(html).toContain("Deep Field Volume");
		for (const control of ["Random JWST", "Random Hubble", "Default field"]) {
			expect(html).toContain(control);
		}
		expect(existsSync(join(ROOT, "public", "deep_field", "index.html"))).toBe(
			false,
		);

		// The WASM module and the catalog fields reach the built site.
		expect(existsSync(join(DOCS, "detect", "detect_bg.wasm"))).toBe(true);
		expect(existsSync(join(DOCS, "potm2507a.jpg"))).toBe(true);
		expect(existsSync(join(DOCS, "allowlist.json"))).toBe(false);
		const fields = JSON.parse(
			readFileSync(join(DOCS, "fields.json"), "utf-8"),
		) as Field[];
		expect(fields.map((f) => f.id)).toContain("potm2507a");
		for (const f of fields) {
			expect(["ESA/Webb", "ESA/Hubble"]).toContain(f.source);
			expect(f.wcs.dim[0]).toBeGreaterThan(0);
			expect(f.sources.length).toBeGreaterThanOrEqual(3);
			expect(Object.keys(f.catalogs).length).toBeGreaterThan(0);
			// Every catalog source lies inside its image.
			for (const [ra, dec, z] of f.sources) {
				const [x, y] = skyToUnit(f.wcs, ra, dec);
				expect(x).toBeGreaterThanOrEqual(0);
				expect(x).toBeLessThan(1);
				expect(y).toBeGreaterThanOrEqual(0);
				expect(y).toBeLessThan(1);
				expect(z).toBeGreaterThan(0);
			}
		}

		// A detected source on a catalog position takes that redshift.
		const f = fields[0];
		const [ra, dec, z] = f.sources[0];
		const [ux, uy] = skyToUnit(f.wcs, ra, dec);
		const hit = matchCatalog(
			[{ id: 1, cx: ux * 1600, cy: uy * 1600 * (f.wcs.dim[1] / f.wcs.dim[0]) }],
			f,
			1600,
			Math.round((1600 * f.wcs.dim[1]) / f.wcs.dim[0]),
		);
		expect(hit.get(1)?.z).toBe(z);

		// mise pins the toolchain that builds the WASM and runs the oracle.
		const mise = parse(readFileSync(join(ROOT, "mise.toml"), "utf-8")) as {
			tools: Record<string, unknown>;
			tasks?: Record<string, unknown>;
		};
		for (const tool of ["uv", "python", "rust", "cargo:wasm-pack"]) {
			expect(Object.keys(mise.tools), `mise tool ${tool}`).toContain(tool);
		}
		expect(Object.keys(mise.tasks ?? {})).toContain("wasm");
	}, 120_000);

	it("agrees approximately with SEP on the bundled image", async () => {
		const { sep, rust } = await compareWithSep(SAMPLE);
		const sepBig = sep.objects.filter((o) => o.area >= 20);
		const rustBig = rust.filter((o) => o.area >= 20);
		expect(sepBig.length).toBeGreaterThan(20);
		expect(matchedFraction(sepBig, rust)).toBeGreaterThanOrEqual(0.85);
		expect(matchedFraction(rustBig, sep.objects)).toBeGreaterThanOrEqual(0.85);
	}, 120_000);

	it.each([
		2, 3,
	])("retains an isolated faint source of amplitude %s that SEP detects", async (amplitude) => {
		const { sep, rust } = await compareWithSep(
			"--faint-source",
			String(amplitude),
		);
		expect(sep.objects).toHaveLength(1);
		expect(rust).toHaveLength(1);
		expect(
			Math.hypot(
				rust[0].cx - sep.objects[0].cx,
				rust[0].cy - sep.objects[0].cy,
			),
		).toBeLessThan(1);
	}, 120_000);
});
