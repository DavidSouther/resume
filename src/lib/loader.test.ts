import { describe, expect, it } from "vitest";
import { tomlLoader } from "./loader";

// Integration-style against the real committed fixture in src/. Vitest runs
// from the project root, so the cwd-relative read resolves without mocking fs.
describe("tomlLoader", () => {
	it("parses the real resume.toml fixture", async () => {
		const resume = await tomlLoader();

		expect(resume.aboutMe.profile.name).toBe("David");
		expect(resume.experience.jobs.length).toBeGreaterThan(0);
	});
});
