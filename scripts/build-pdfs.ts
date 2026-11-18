import { join } from "node:path";
import { cwd } from "node:process";
import { makeServer } from "@davidsouther/jiffies/server/http/index.ts";
import { chromium } from "playwright";

// Prints the built resume (/) and academic CV (/cv/) to PDF with Chromium, using
// each page's own print stylesheet, so the PDFs track src/resume.toml instead of
// being committed binaries. Run after `npm run build:site`; writes into docs/.
//
// Names carry the author so the files stay distinct in a Downloads folder.
// Set CHROMIUM_PATH to use a browser other than Playwright's own download.

export const PDFS = [
	{ route: "/", file: "david_souther_resume.pdf" },
	{ route: "/cv/", file: "david_souther_cv.pdf" },
] as const;

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
			await page.goto(origin + route, { waitUntil: "networkidle" });
			await page.pdf({
				path: join(root, file),
				preferCSSPageSize: true,
				printBackground: false,
			});
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
