import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("mise papers feature", () => {
	it("delegates through the npm papers script to both paper compiler wrappers", () => {
		const packageJson = JSON.parse(
			readFileSync(join(root, "package.json"), "utf8"),
		) as { scripts?: Record<string, string> };
		const mise = parse(readFileSync(join(root, "mise.toml"), "utf8")) as {
			tasks?: Record<string, { run?: string }>;
		};

		expect(mise.tasks?.papers?.run).toBe("npm run papers");
		expect(packageJson.scripts?.papers).toBe(
			"node posts/llm_manifold/scripts/compile-manifold-paper.ts && node posts/rrf_coverage_normalization/scripts/compile-rrf-coverage-normalization.ts",
		);
	});
});
