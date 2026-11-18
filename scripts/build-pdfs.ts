import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { makeServer } from "@davidsouther/jiffies/server/http/index.ts";
import { chromium } from "playwright";
import { CV_PDF, RESUME_PDF } from "../src/lib/pdfs.ts";

// Prints the built resume (/) and academic CV (/cv/) to PDF with Chromium, using
// each page's own print stylesheet, so the PDFs cannot drift from
// src/resume.toml. Run after `npm run build:site`; writes into docs/.
// Set CHROMIUM_PATH to use a browser other than Playwright's own download.

export const PDFS = [
	{ route: "/", file: RESUME_PDF },
	{ route: "/cv/", file: CV_PDF },
] as const;

/** Throws unless the route answered with a 2xx status. */
export function assertOk(route: string, status: number): void {
	if (status < 200 || status > 299)
		throw new Error(`${route} answered ${status}`);
}

/** Throws unless `path` is a non-empty file that starts with the PDF magic. */
export function verifyPdf(path: string): void {
	if (!existsSync(path)) throw new Error(`${path} was not written`);
	if (statSync(path).size === 0) throw new Error(`${path} is empty`);
	const magic = readFileSync(path).subarray(0, 5).toString("latin1");
	if (magic !== "%PDF-") throw new Error(`${path} is not a PDF`);
}

export async function buildPdfs(root = join(cwd(), "docs")): Promise<string[]> {
	const server = await makeServer({ root });
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("no port");
	const origin = `http://127.0.0.1:${address.port}`;

	const browser = await chromium.launch({
		executablePath: process.env.CHROMIUM_PATH || undefined,
	});
	try {
		const page = await browser.newPage();
		await page.emulateMedia({ media: "print" });
		for (const { route, file } of PDFS) {
			const response = await page.goto(origin + route, {
				waitUntil: "networkidle" /* fonts and CSS loaded */,
			});
			assertOk(route, response?.status() ?? 0);
			// The print stylesheet owns page size and uses no background fills.
			// `tagged` and `outline` give screen readers a structure tree and
			// readers a bookmark per section heading.
			await page.pdf({
				path: join(root, file),
				preferCSSPageSize: true,
				printBackground: false,
				tagged: true,
				outline: true,
			});
			verifyPdf(join(root, file));
		}
	} finally {
		await browser.close();
		server.close();
	}
	return PDFS.map(({ file }) => file);
}

if (import.meta.main) {
	try {
		for (const file of await buildPdfs()) console.log(`docs/${file}`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
