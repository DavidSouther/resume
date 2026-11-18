import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertOk, verifyPdf } from "./build-pdfs.ts";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "build-pdfs-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("verifyPdf", () => {
	it("accepts a file that starts with %PDF-", () => {
		const path = join(dir, "ok.pdf");
		writeFileSync(path, "%PDF-1.7\n%%EOF");
		expect(() => verifyPdf(path)).not.toThrow();
	});

	it("rejects an empty file", () => {
		const path = join(dir, "empty.pdf");
		writeFileSync(path, "");
		expect(() => verifyPdf(path)).toThrow(/empty/);
	});

	it("rejects a missing file", () => {
		expect(() => verifyPdf(join(dir, "missing.pdf"))).toThrow(/missing\.pdf/);
	});

	it("rejects a file that is not a PDF", () => {
		const path = join(dir, "page.pdf");
		writeFileSync(path, "<html>404</html>");
		expect(() => verifyPdf(path)).toThrow(/not a PDF/);
	});
});

describe("assertOk", () => {
	it("passes a 2xx status", () => {
		expect(() => assertOk("/cv/", 200)).not.toThrow();
	});

	it("rejects 404, 500 and redirects, naming the route", () => {
		for (const status of [404, 500, 301]) {
			expect(() => assertOk("/cv/", status)).toThrow(`/cv/ answered ${status}`);
		}
	});
});
