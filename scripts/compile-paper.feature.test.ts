import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..");
const rrfPaperDir = resolve(
	repositoryRoot,
	"posts",
	"rrf_coverage_normalization",
);
const rrfOutput = resolve(
	rrfPaperDir,
	"build",
	"rrf-coverage-normalization.pdf",
);
const rrfPublicPdf = resolve(
	repositoryRoot,
	"public",
	"papers",
	"rrf-coverage-normalization.pdf",
);
const rrfCompiler = resolve(
	rrfPaperDir,
	"scripts",
	"compile-rrf-coverage-normalization.ts",
);
const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0))
		rmSync(directory, { force: true, recursive: true });
});

describe("shared paper compiler feature", () => {
	// One test owns the RRF build output (build/ and public/papers/), so no
	// other test file may compile that paper: vitest runs files in parallel
	// workers and two compiles of one paper would race on the same PDF.
	it("routes the RRF wrapper through the shared compiler, writes its PDF, and copies it to public/papers", {
		timeout: 120_000,
	}, () => {
		const logDirectory = mkdtempSync(
			resolve(tmpdir(), "compile-paper-feature-"),
		);
		temporaryDirectories.push(logDirectory);
		const invocationLog = resolve(logDirectory, "invocations.jsonl");
		rmSync(rrfOutput, { force: true });
		const environment = {
			...process.env,
			PAPER_COMPILER_INVOCATION_LOG: invocationLog,
		};

		const rrf = spawnSync(process.execPath, [rrfCompiler], {
			cwd: repositoryRoot,
			env: environment,
			timeout: 100_000,
		});

		expect(rrf.status, rrf.stderr?.toString()).toBe(0);
		const invocations = readFileSync(invocationLog, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as { paperDir: string });
		expect(invocations).toEqual([
			{ paperDir: rrfPaperDir, outputPdf: rrfOutput },
		]);
		expect(existsSync(rrfOutput)).toBe(true);
		expect(statSync(rrfOutput).size).toBeGreaterThan(0);
		expect(readFileSync(rrfPublicPdf)).toEqual(readFileSync(rrfOutput));
	});
});
