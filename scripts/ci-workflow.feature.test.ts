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

	it("ci.yml runs on pull requests against any base, so stacked PRs get CI", () => {
		const pr = ci.on.pull_request as Record<string, unknown> | null;
		expect(pr?.branches).toBeUndefined();
		expect(pr?.["branches-ignore"]).toBeUndefined();
	});

	it("ci.yml builds through the shared composite action and runs tests", () => {
		const s = steps(ci, "build");
		expect(s.some((x) => x.uses === BUILD_ACTION)).toBe(true);
		const site = s.find((x) =>
			x.run?.startsWith("npm run test:site -- --exclude"),
		);
		expect(site?.run).toContain("pages/deep_field/deep-field.feature.test.ts");
		expect(site?.if, "general site tests run on every PR").toBeUndefined();
	});

	it("runs Deep Field tests and builds separately for relevant changes", () => {
		const deepField = workflow(".github/workflows/deep-field.yml");
		const pr = deepField.on.pull_request as { paths: string[] };
		expect(pr.paths).toContain("pages/deep_field/**");
		expect(pr.paths).toContain(".github/workflows/deep-field.yml");
		const commands = steps(deepField, "test").map((step) => step.run);
		expect(commands).toContain("mise run wasm");
		expect(commands).toContain("mise run test:rust");
		expect(commands).toContain(
			"npm run test:site -- pages/deep_field/deep-field.feature.test.ts",
		);
		expect(steps(ci, "build").map((step) => step.run)).not.toContain(
			"mise run wasm",
		);
	});

	it("keeps general npm build and test commands independent of Rust", () => {
		const pkg = JSON.parse(load("package.json")) as {
			scripts: Record<string, string>;
		};
		for (const name of ["dev", "build", "build:site", "test"]) {
			expect(pkg.scripts[name]).not.toMatch(/wasm|test:rust|cargo/);
		}
		expect(pkg.scripts.test).toContain(
			"--exclude pages/deep_field/deep-field.feature.test.ts",
		);
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

	it("deploys only a WASM bundle built from the checked-out detector sources", () => {
		const deepField = workflow(".github/workflows/deep-field.yml");
		const packageStep = steps(deepField, "test").find(
			(x) => x.name === "Package Deep Field WASM",
		);
		const fetch = steps(deploy, "build-deploy").find(
			(x) => x.name === "Fetch current Deep Field WASM",
		);
		const sourceHash =
			"git ls-tree -r HEAD -- pages/deep_field/detect mise.toml package.json | sha256sum";
		expect(packageStep?.run).toContain(sourceHash);
		expect(fetch?.run).toContain(sourceHash);
		expect(fetch?.run).toContain('"$actual" != "$expected"');
		expect(
			steps(deepField, "publish").some((x) =>
				x.run?.includes("gh workflow run deploy.yml"),
			),
		).toBe(true);
	});

	it("deploy.yml rebuilds on dispatch instead of reusing an artifact", () => {
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

describe("the shared build action prints the resume and CV PDFs", () => {
	const action = parse(load(".github/actions/build-site/action.yml")) as {
		runs: { steps: (Step & { "continue-on-error"?: boolean })[] };
	};
	const runs = action.runs.steps.map((x) => x.run ?? "");

	it("installs Chromium and runs the PDF build after the site build", () => {
		const chromium = runs.findIndex((r) => r.includes("playwright install"));
		const pdfs = runs.findIndex((r) => r.includes("npm run pdfs"));
		const site = runs.findIndex((r) => r.includes("npm run build:site"));
		expect(chromium).toBeGreaterThan(site);
		expect(pdfs).toBeGreaterThan(chromium);
	});

	it("a failed PDF build fails the action, so it blocks the deploy", () => {
		const step = action.runs.steps.find((x) => x.run?.includes("npm run pdfs"));
		expect(step, "the action has no PDF step").toBeDefined();
		expect(step).not.toHaveProperty("continue-on-error");
		const last = action.runs.steps.at(-1);
		expect(last?.run).toContain("npm run pdfs");
	});

	it("the pdfs script is wired to build-pdfs.ts and names both outputs", () => {
		const pkg = JSON.parse(load("package.json")) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts.pdfs).toBe("node scripts/build-pdfs.ts");
		expect(load("scripts/build-pdfs.ts")).toContain("../src/lib/pdfs.ts");
		const names = load("src/lib/pdfs.ts");
		expect(names).toContain('"david_souther_resume.pdf"');
		expect(names).toContain('"david_souther_cv.pdf"');
	});
});
