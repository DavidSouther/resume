// @vitest-environment jsdom
//
// Feature: the resume and the CV are two views of one src/resume.toml, and CI
// prints each one to a PDF a reader can save.
//
//   Given every role is written once in src/resume.toml,
//     and the research interests exist only in its CV-only `[cv]` table,
//   When a reader opens the resume (/) and the CV (/cv),
//   Then the Code Fellows role reads the same in both,
//     and the CV lists it once, under teaching, not again under professional,
//     and the CV lists every job, while the interests appear on the CV alone.
//   When CI prints the built site,
//   Then docs/ holds david_souther_resume.pdf and david_souther_cv.pdf.
//
// Design: .ailly/developer/2026-11-18-A-cv-pdfs/design.md

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { afterEach, describe, expect, it } from "vitest";
import { MD } from "../../src/components/p.ts";
import { resetDom } from "../../src/components/test-dom.ts";
import resumePage from "../page.ts";
import cvPage from "./page.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const DOCS = join(ROOT, "docs");

interface Toml {
	experience: {
		jobs: {
			organization: { name: string };
			roles: { challenges?: { description: string }[] }[];
		}[];
	};
	cv?: { interests?: { title: string }[] };
}

const toml = parse(
	readFileSync(join(ROOT, "src", "resume.toml"), "utf-8"),
) as unknown as Toml;

afterEach(resetDom);

/** Collapse whitespace so Markdown line wrapping does not affect matching. */
function words(text: string | null | undefined): string {
	return (text ?? "").replace(/\s+/g, " ").trim();
}

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

/** The section a CV heading opens: the heading plus everything under it. */
function cvSection(cv: HTMLElement, heading: RegExp): string {
	const h2 = [...cv.querySelectorAll("h2")].find((h) =>
		heading.test(h.textContent ?? ""),
	);
	expect(h2, `the CV has no section heading matching ${heading}`).toBeDefined();
	return words(h2?.closest("section")?.textContent);
}

/** A browser Playwright can launch: CHROMIUM_PATH, or its own download. */
async function chromiumAvailable(): Promise<boolean> {
	if (process.env.CHROMIUM_PATH) return existsSync(process.env.CHROMIUM_PATH);
	try {
		const { chromium } = await import("playwright");
		return existsSync(chromium.executablePath());
	} catch {
		return false;
	}
}

const hasChromium = await chromiumAvailable();

describe("the resume and the CV share one source and both print to PDF", () => {
	it("shows the Code Fellows role in both views, once on the CV under teaching", async () => {
		const resume = words(
			((await resumePage.default()) as HTMLElement).textContent,
		);
		const cvRoot = (await cvPage.default()) as HTMLElement;
		const cv = words(cvRoot.textContent);

		// The role text as authored in src/resume.toml, rendered the way both
		// views render Markdown.
		const codeFellows = toml.experience.jobs.find(
			(job) => job.organization.name === "Code Fellows",
		);
		const description = codeFellows?.roles[0]?.challenges?.[0]?.description;
		expect(
			description,
			"src/resume.toml has no Code Fellows role text",
		).toBeDefined();
		const roleText = words(MD(description ?? "").textContent);

		expect(occurrences(resume, roleText), "Code Fellows on the resume").toBe(1);
		expect(occurrences(cv, roleText), "Code Fellows on the CV").toBe(1);
		expect(cvSection(cvRoot, /teaching appointments/i)).toContain(roleText);
		expect(cvSection(cvRoot, /professional appointments/i)).not.toContain(
			"Code Fellows",
		);

		// The CV is the complete record: every job appears on it.
		for (const job of toml.experience.jobs) {
			expect(cv, `${job.organization.name} is missing from the CV`).toContain(
				job.organization.name,
			);
		}

		// Research interests are CV-only content.
		const interests = toml.cv?.interests ?? [];
		expect(
			interests.length,
			"src/resume.toml has no [[cv.interests]]",
		).toBeGreaterThan(0);
		for (const { title } of interests) {
			expect(cv).toContain(title);
			expect(resume).not.toContain(title);
		}
	});

	it.skipIf(!hasChromium)(
		"prints david_souther_resume.pdf and david_souther_cv.pdf from the built site (needs Chromium: set CHROMIUM_PATH or run `npx playwright install chromium`)",
		() => {
			expect(
				existsSync(join(DOCS, "cv", "index.html")),
				"docs/ is not built; run `npm run build:site` first",
			).toBe(true);
			const files = ["david_souther_resume.pdf", "david_souther_cv.pdf"];
			for (const file of files) rmSync(join(DOCS, file), { force: true });

			const run = spawnSync(process.execPath, ["scripts/build-pdfs.ts"], {
				cwd: ROOT,
				encoding: "utf-8",
				timeout: 120_000,
			});
			expect(run.status, `build-pdfs failed:\n${run.stderr}`).toBe(0);

			for (const file of files) {
				const path = join(DOCS, file);
				expect(existsSync(path), `docs/${file} was not printed`).toBe(true);
				expect(statSync(path).size, `docs/${file} is empty`).toBeGreaterThan(0);
				const pdf = readFileSync(path, "latin1");
				expect(pdf.startsWith("%PDF-"), `docs/${file} is not a PDF`).toBe(true);
				// `outline: true` gives the reader a bookmark per section heading;
				// `tagged: true` gives screen readers the heading and list structure.
				expect(
					pdf.includes("/Outlines"),
					`docs/${file} has no document outline`,
				).toBe(true);
				expect(
					pdf.includes("/StructTreeRoot"),
					`docs/${file} is not a tagged PDF`,
				).toBe(true);
			}
		},
		180_000,
	);
});
