import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// This test lives in scripts/, so the repo root is one directory up.
const ROOT = join(import.meta.dirname, "..");

type Step = { name?: string; uses?: string; if?: string; run?: string };
type Job = { steps: Step[]; if?: string; needs?: string };
type Workflow = { on: Record<string, unknown>; jobs: Record<string, Job> };

const census = parse(
	readFileSync(join(ROOT, ".github/workflows/census.yml"), "utf-8"),
) as Workflow;

describe("census.yml publishes NYC polling data off the site build path", () => {
	it("generates on code changes, schedule and demand", () => {
		expect(Object.keys(census.on)).toEqual(
			expect.arrayContaining([
				"pull_request",
				"push",
				"schedule",
				"workflow_dispatch",
			]),
		);
		const gen = census.jobs.generate.steps.map((x) => x.run ?? "").join("\n");
		expect(gen).toContain("nyc_tracts_geojson.py");
	});

	it("publishes only off pull requests, then redeploys", () => {
		expect(census.jobs.publish.needs).toBe("generate");
		expect(census.jobs.publish.if).toContain("!= 'pull_request'");
		const runs = census.jobs.publish.steps.map((x) => x.run ?? "").join("\n");
		expect(runs).toContain("gh release upload");
		expect(runs).toContain("gh workflow run deploy.yml");
	});
});
