import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const PAGE = join(ROOT, "docs/astrolabe/index.html");

describe("astrolabe rewrite: SSG pipeline produces /astrolabe/", () => {
	beforeAll(() => {
		const result = spawnSync("npm", ["run", "build"], {
			cwd: ROOT,
			encoding: "utf-8",
		});
		if (result.status !== 0) {
			throw new Error(
				`Build failed (exit ${result.status}):\n${result.stderr}`,
			);
		}
	}, 120_000);

	it("produces docs/astrolabe/index.html", () => {
		expect(existsSync(PAGE)).toBe(true);
	});

	it("includes the astronomy-engine CDN script", () => {
		const html = readFileSync(PAGE, "utf-8");
		expect(html).toContain("astronomy-engine");
	});

	it("injects the bundled client module into the page", () => {
		const html = readFileSync(PAGE, "utf-8");
		expect(html).toMatch(/\/assets\/[^"]+\.js/);
	});

	it("renders the SVG dial", () => {
		const html = readFileSync(PAGE, "utf-8");
		expect(html).toContain('viewBox="0 0 1000 1000"');
		expect(html).toContain("<g");
	});

	it("renders the controls panel", () => {
		const html = readFileSync(PAGE, "utf-8");
		expect(html).toContain('id="controls"');
	});

	it("does not contain the Claude artifact bridge", () => {
		const html = readFileSync(PAGE, "utf-8");
		expect(html).not.toContain("window.claude");
	});
});
