import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

// Feature: a visitor opens /deep_field/ and gets the Deep Field Volume page,
// whose detector is a Rust/WASM port that agrees with SEP on the bundled image.
//
// Given the built site (docs/ is built once by vitest's global setup),
// When the Deep Field page, its WASM detector, sample and allow-list are read,
// Then the page ships them, the old static page is gone, the toolchain is pinned,
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

describe("Deep Field Volume page", () => {
	it("ships the page, WASM detector, sample and allow-list, and the detector agrees with SEP", async () => {
		// The page is built from pages/deep_field and the old static copy is gone.
		const html = readFileSync(join(DOCS, "index.html"), "utf-8");
		expect(html).toContain("Deep Field Volume");
		for (const control of ["Random JWST", "Random Hubble", "JWST sample"]) {
			expect(html).toContain(control);
		}
		expect(existsSync(join(ROOT, "public", "deep_field", "index.html"))).toBe(
			false,
		);

		// The WASM module, sample image and allow-list reach the built site.
		expect(existsSync(join(DOCS, "detect", "detect_bg.wasm"))).toBe(true);
		expect(existsSync(join(DOCS, "potm2301a.png"))).toBe(true);
		const allow = JSON.parse(
			readFileSync(join(DOCS, "allowlist.json"), "utf-8"),
		) as { id: string; source: string; title: string }[];
		expect(allow.length).toBeGreaterThanOrEqual(10);
		for (const entry of allow) {
			expect(entry.id).toBeTruthy();
			expect(["ESA/Webb", "ESA/Hubble"]).toContain(entry.source);
		}

		// mise pins the toolchain that builds the WASM and runs the oracle.
		const mise = parse(readFileSync(join(ROOT, "mise.toml"), "utf-8")) as {
			tools: Record<string, unknown>;
			tasks?: Record<string, unknown>;
		};
		for (const tool of ["uv", "python", "rust", "cargo:wasm-pack"]) {
			expect(Object.keys(mise.tools), `mise tool ${tool}`).toContain(tool);
		}
		expect(Object.keys(mise.tasks ?? {})).toContain("wasm");

		// SEP, run as a black box through uv, is the definition of correct.
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
				SAMPLE,
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

		const sepBig = sep.objects.filter((o) => o.area >= 20);
		const rustBig = rust.filter((o) => o.area >= 20);
		expect(sepBig.length).toBeGreaterThan(20);
		expect(matchedFraction(sepBig, rust)).toBeGreaterThanOrEqual(0.85);
		expect(matchedFraction(rustBig, sep.objects)).toBeGreaterThanOrEqual(0.85);
	}, 120_000);
});
