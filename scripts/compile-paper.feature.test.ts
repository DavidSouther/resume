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
const manifoldCompiler = resolve(
	repositoryRoot,
	"posts",
	"llm_manifold",
	"scripts",
	"compile-manifold-paper.ts",
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
	it("routes both stable wrappers through the shared compiler and writes the RRF PDF", () => {
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

		const manifold = spawnSync(process.execPath, [manifoldCompiler], {
			cwd: repositoryRoot,
			env: environment,
		});
		const rrf = spawnSync(process.execPath, [rrfCompiler], {
			cwd: repositoryRoot,
			env: environment,
		});

		expect(manifold.status).toBe(0);
		expect(rrf.status).toBe(0);
		const invocations = readFileSync(invocationLog, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as { paperDir: string });
		expect(invocations).toEqual([
			{
				paperDir: resolve(repositoryRoot, "posts", "llm_manifold"),
				outputPdf: resolve(
					repositoryRoot,
					"posts",
					"llm_manifold",
					"build",
					"llm_manifold",
					"manifold-paper.pdf",
				),
			},
			{ paperDir: rrfPaperDir, outputPdf: rrfOutput },
		]);
		expect(existsSync(rrfOutput)).toBe(true);
		expect(statSync(rrfOutput).size).toBeGreaterThan(0);
	});
});
