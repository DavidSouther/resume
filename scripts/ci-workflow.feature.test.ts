import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// This test lives in scripts/, so the repo root is one directory up.
const ROOT = join(import.meta.dirname, "..");

type Step = {
	name?: string;
	uses?: string;
	if?: string;
	run?: string;
	with?: Record<string, unknown>;
};
type Workflow = {
	on: Record<string, unknown>;
	jobs: Record<string, { steps: Step[] }>;
};

function load(path: string): string {
	return readFileSync(join(ROOT, path), "utf-8");
}
function workflow(path: string): Workflow {
	return parse(load(path)) as Workflow;
}
function steps(wf: Workflow, job: string): Step[] {
	return wf.jobs[job].steps;
}

const BUILD_ACTION = "./.github/actions/build-site";

describe("PR builds gate merge and the release reuses the approved build", () => {
	const ci = workflow(".github/workflows/ci.yml");
	const deploy = workflow(".github/workflows/deploy.yml");

	it("ci.yml runs on pull_request and exposes a job named build", () => {
		expect(Object.keys(ci.on)).toContain("pull_request");
		expect(Object.keys(ci.jobs)).toContain("build");
	});

	it("ci.yml builds through the shared composite action and runs tests", () => {
		const s = steps(ci, "build");
		expect(s.some((x) => x.uses === BUILD_ACTION)).toBe(true);
		expect(s.some((x) => x.run?.includes("npm test"))).toBe(true);
	});

	it("ci.yml uploads docs as a tree-hash keyed artifact with bounded retention", () => {
		const upload = steps(ci, "build").find((x) =>
			x.uses?.startsWith("actions/upload-artifact"),
		);
		expect(upload?.with?.name).toMatch(/^site-\$\{\{.*tree.*\}\}$/);
		expect(upload?.with?.path).toBe("docs");
		expect(upload?.with?.["retention-days"]).toBeDefined();
		// docs/.nojekyll must survive the round trip.
		expect(upload?.with?.["include-hidden-files"]).toBe(true);
	});

	it("site builds fetch polling data from a release and never generate it", () => {
		const action = parse(load(".github/actions/build-site/action.yml")) as {
			runs: { steps: Step[] };
		};
		const text = JSON.stringify(action.runs.steps);
		expect(text).toContain("gh release download nyc-polling-data");
		expect(text).not.toContain("nyc_tracts_geojson.py");
		expect(load(".github/workflows/ci.yml")).not.toContain("CENSUS_API_KEY");
		expect(load(".github/workflows/deploy.yml")).not.toContain(
			"CENSUS_API_KEY",
		);
	});

	it("census.yml generates on code, schedule and demand, and publishes only off PRs", () => {
		const census = workflow(".github/workflows/census.yml") as Workflow & {
			jobs: Record<string, { steps: Step[]; if?: string; needs?: string }>;
		};
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
		expect(census.jobs.publish.needs).toBe("generate");
		expect(census.jobs.publish.if).toContain("!= 'pull_request'");
		expect(
			census.jobs.publish.steps.some((x) =>
				x.run?.includes("gh release upload"),
			),
		).toBe(true);
	});

	it("census.yml redeploys after publishing and deploy rebuilds on dispatch", () => {
		const census = workflow(".github/workflows/census.yml") as Workflow & {
			jobs: Record<string, { steps: Step[] }>;
		};
		expect(
			census.jobs.publish.steps.some((x) =>
				x.run?.includes("gh workflow run deploy.yml"),
			),
		).toBe(true);
		expect(deploy.on).toHaveProperty("workflow_dispatch");
		const lookup = steps(deploy, "build-deploy").find((x) =>
			x.run?.includes("actions/artifacts"),
		);
		expect(lookup?.if).toMatch(/event_name\s*==\s*'push'/);
	});

	it("deploy.yml looks up the same artifact name and builds only on a miss", () => {
		const s = steps(deploy, "build-deploy");
		const lookup = s.find((x) => x.run?.includes("actions/artifacts"));
		expect(lookup, "deploy.yml needs an artifact lookup step").toBeDefined();
		expect(lookup?.run).toContain("site-");
		const build = s.find((x) => x.uses === BUILD_ACTION);
		expect(build?.if).toMatch(/hit\s*!=\s*'true'/);
	});

	it("deploy.yml downloads the artifact only on a hit and still deploys", () => {
		const s = steps(deploy, "build-deploy");
		const download = s.find((x) =>
			x.uses?.startsWith("actions/download-artifact"),
		);
		expect(download?.if).toMatch(/hit\s*==\s*'true'/);
		expect(s.some((x) => x.uses?.startsWith("actions/deploy-pages"))).toBe(
			true,
		);
	});

	it("the composite action exists and declares composite steps", () => {
		const action = parse(load(".github/actions/build-site/action.yml")) as {
			runs: { using: string; steps: unknown[] };
		};
		expect(action.runs.using).toBe("composite");
		expect(action.runs.steps.length).toBeGreaterThan(0);
	});
});
