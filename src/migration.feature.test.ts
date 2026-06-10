import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

describe("Next.js → Jiffies migration", () => {
	beforeAll(() => {
		const result = spawnSync("npm", ["run", "build"], {
			cwd: ROOT,
			encoding: "utf-8",
		});
		if (result.status !== 0) {
			throw new Error(
				`Build failed (exit ${result.status}):\n${result.stderr}`,
			);
		}
	}, 120_000);

	it("removes React and Next.js from package.json", () => {
		const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
		const all = { ...pkg.dependencies, ...pkg.devDependencies };
		for (const removed of [
			"react",
			"react-dom",
			"next",
			"@types/react",
			"@vitejs/plugin-react",
			"@testing-library/react",
			"nextjs-google-analytics",
		]) {
			expect(
				Object.keys(all),
				`${removed} still in package.json`,
			).not.toContain(removed);
		}
	});

	it("no source file under src/ or pages/ imports from react or next", () => {
		function scanDir(dir: string): string[] {
			if (!existsSync(dir)) return [];
			return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
				const full = join(dir, e.name);
				if (e.isDirectory() && !e.name.startsWith(".")) return scanDir(full);
				if (e.isFile() && /\.tsx?$/.test(e.name)) return [full];
				return [];
			});
		}
		const sources = [
			...scanDir(join(ROOT, "src")),
			...scanDir(join(ROOT, "pages")),
		];
		for (const file of sources) {
			const content = readFileSync(file, "utf-8");
			expect(content, `${file} imports from react`).not.toMatch(
				/from ['"]react['"]/,
			);
			expect(content, `${file} imports from next`).not.toMatch(
				/from ['"]next\//,
			);
		}
	});

	it("writes docs/index.html with resume owner name and jiffies-css stylesheet", () => {
		expect(existsSync(join(ROOT, "docs/index.html"))).toBe(true);
		const html = readFileSync(join(ROOT, "docs/index.html"), "utf-8");
		expect(html).toContain("David Souther");
		expect(html).toContain(
			"https://unpkg.com/@davidsouther/jiffies-css@2.0.0/jiffies-css-v2-bundle.min.css",
		);
	});

	it("docs/index.html has the millisecond-modulo theme picker", () => {
		const html = readFileSync(join(ROOT, "docs/index.html"), "utf-8");
		expect(html).toContain('["rust","teal","indigo","nominal"]');
		expect(html).toContain("Date.now()%");
	});

	it("docs/index.html has the GA4 analytics snippet", () => {
		const html = readFileSync(join(ROOT, "docs/index.html"), "utf-8");
		expect(html).toContain("G-6X1Z1L95D8");
	});

	it("writes docs/blog/index.html with links to posts", () => {
		expect(existsSync(join(ROOT, "docs/blog/index.html"))).toBe(true);
		const html = readFileSync(join(ROOT, "docs/blog/index.html"), "utf-8");
		expect(html).toMatch(/href="\/blog\/[^"]+"/);
	});

	it("writes one docs/blog/<id>/index.html per post in posts/", () => {
		const postIds = readdirSync(join(ROOT, "posts"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(/\.md$/, ""));

		expect(postIds.length).toBeGreaterThan(0);
		for (const id of postIds) {
			const path = join(ROOT, `docs/blog/${id}/index.html`);
			expect(existsSync(path), `missing docs/blog/${id}/index.html`).toBe(true);
			const html = readFileSync(path, "utf-8");
			expect(html.length, `${id} page is too small`).toBeGreaterThan(500);
		}
	});

	it("writes docs/trips/index.html with links to trips", () => {
		expect(existsSync(join(ROOT, "docs/trips/index.html"))).toBe(true);
		const html = readFileSync(join(ROOT, "docs/trips/index.html"), "utf-8");
		expect(html).toMatch(/href="\/trips\/[^"]+"/);
	});

	it("writes docs/CNAME with davidsouther.com", () => {
		expect(readFileSync(join(ROOT, "docs/CNAME"), "utf-8").trim()).toBe(
			"davidsouther.com",
		);
	});

	it("writes docs/.nojekyll", () => {
		expect(existsSync(join(ROOT, "docs/.nojekyll"))).toBe(true);
	});

	it("writes docs/robots.txt", () => {
		expect(existsSync(join(ROOT, "docs/robots.txt"))).toBe(true);
	});

	it("writes docs/sitemap.xml containing the root URL", () => {
		const xml = readFileSync(join(ROOT, "docs/sitemap.xml"), "utf-8");
		expect(xml).toContain("<loc>https://davidsouther.com/</loc>");
	});
});
