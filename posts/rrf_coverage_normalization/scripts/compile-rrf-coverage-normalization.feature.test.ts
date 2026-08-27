import { spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paperDir = resolve(import.meta.dirname, "..");
const outputPdf = resolve(paperDir, "build", "rrf-coverage-normalization.pdf");
const compiler = resolve(import.meta.dirname, "compile-rrf-coverage-normalization.ts");

describe("RRF coverage-normalization paper compiler", () => {
	it("compiles the real stub section to a PDF", () => {
		rmSync(outputPdf, { force: true });

		const result = spawnSync(process.execPath, [compiler], {
			cwd: resolve(paperDir, "..", ".."),
		});

		expect(result.status).toBe(0);
		expect(existsSync(outputPdf)).toBe(true);
		expect(statSync(outputPdf).size).toBeGreaterThan(0);
	});
});
