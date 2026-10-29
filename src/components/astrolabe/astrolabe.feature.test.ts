import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const PAGE = join(ROOT, "docs/astrolabe/index.html");

describe("astrolabe rewrite: SSG pipeline produces /astrolabe/", () => {
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
