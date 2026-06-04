import fs from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonLoader, tomlLoader } from "./loader";

// Integration-style against the real committed fixtures in src/app. Vitest runs
// from the project root, so the cwd-relative reads resolve without mocking fs.
// The fallback branch is the one exception: it only fires on a read failure, so
// that single test spies on fs.readFile to force the catch path.
afterEach(() => {
	vi.restoreAllMocks();
});

describe("jsonLoader", () => {
	it("parses the real resume.json fixture", async () => {
		const resume = await jsonLoader();

		expect(resume.aboutMe.profile.name).toBe("David");
		expect(resume.settings.language).toBe("EN");
	});

	it("returns the built-in default when the read fails", async () => {
		vi.spyOn(fs, "readFile").mockRejectedValueOnce(new Error("ENOENT"));

		const resume = await jsonLoader();

		expect(resume.aboutMe.profile.name).toBe("David Souther");
		expect(resume.experience.jobs).toEqual([]);
	});
});

describe("tomlLoader", () => {
	it("parses the real resume.toml fixture", async () => {
		const resume = await tomlLoader();

		expect(resume.aboutMe.profile.name).toBe("David");
		expect(resume.experience.jobs.length).toBeGreaterThan(0);
	});
});
