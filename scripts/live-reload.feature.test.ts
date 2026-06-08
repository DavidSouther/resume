import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { RELOAD_PATH, startWatchServer } from "./live-reload.ts";

// User story: running `npm start -- --watch`, saving an edit to a source file
// reloads the open browser. Exercised browser-free over HTTP via the two
// contracts that cause the reload: pages carry the poller, and the polled build
// id advances after a watched file changes.

let cleanup: (() => Promise<void>) | undefined;

afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

it("editing a watched file advances the polled live-reload id and pages carry the poller", async () => {
	const base = await mkdtemp(join(tmpdir(), "lr-"));
	const docs = join(base, "docs");
	const src = join(base, "src");
	await mkdir(docs, { recursive: true });
	await mkdir(src, { recursive: true });
	await writeFile(
		join(docs, "index.html"),
		"<!doctype html><html><body><h1>hi</h1></body></html>",
	);
	await writeFile(join(src, "page.ts"), "export const x = 1;\n");

	const server = await startWatchServer({
		root: docs,
		watchDirs: [src],
		rebuild: async () => true, // fake build: succeed without the real ssg
		reloadIntervalMs: 30,
		debounceMs: 20,
		port: 0,
		host: "127.0.0.1",
	});
	cleanup = server.close;
	const url = (p: string) => `http://127.0.0.1:${server.port}${p}`;

	// Pages carry the poller that drives the reload.
	const page = await fetch(url("/")).then((r) => r.text());
	expect(page).toContain(RELOAD_PATH);
	expect(page).toMatch(/location\.reload/);

	const before = await fetch(url(RELOAD_PATH)).then((r) => r.text());

	// Save an edit to a watched file.
	await writeFile(join(src, "page.ts"), "export const x = 2;\n");

	// The polled id advances within a bound, so an open browser would reload.
	const deadline = Date.now() + 4000;
	let after = before;
	while (Date.now() < deadline) {
		after = await fetch(url(RELOAD_PATH)).then((r) => r.text());
		if (after !== before) break;
		await new Promise((r) => setTimeout(r, 25));
	}
	expect(after).not.toEqual(before);
}, 10_000);

it("a build that writes into a watched dir does not retrigger itself (no reload loop)", async () => {
	const base = await mkdtemp(join(tmpdir(), "lr-"));
	const docs = join(base, "docs");
	const src = join(base, "src");
	const pub = join(base, "public");
	await mkdir(docs, { recursive: true });
	await mkdir(src, { recursive: true });
	await mkdir(pub, { recursive: true });
	await writeFile(join(docs, "index.html"), "<!doctype html><body></body>");
	await writeFile(join(src, "page.ts"), "export const x = 1;\n");

	// The fake build writes a generated file back into a watched dir, like
	// css:bundle writing public/global.css. That write is ignored.
	const generated = join(pub, "global.css");
	const server = await startWatchServer({
		root: docs,
		watchDirs: [src, pub],
		ignore: (file) => file === generated,
		rebuild: async () => {
			await writeFile(generated, "/* built */");
			return true;
		},
		debounceMs: 20,
		port: 0,
		host: "127.0.0.1",
	});
	cleanup = server.close;
	const idUrl = `http://127.0.0.1:${server.port}${RELOAD_PATH}`;

	// One real edit to a non-ignored file triggers exactly one rebuild.
	const id0 = await fetch(idUrl).then((r) => r.text());
	await writeFile(join(src, "page.ts"), "export const x = 2;\n");

	const deadline = Date.now() + 3000;
	let id1 = id0;
	while (Date.now() < deadline) {
		id1 = await fetch(idUrl).then((r) => r.text());
		if (id1 !== id0) break;
		await new Promise((r) => setTimeout(r, 25));
	}
	expect(id1).not.toEqual(id0);

	// The rebuild wrote the ignored generated file. If that retriggered, the id
	// would keep climbing; assert it has settled.
	await new Promise((r) => setTimeout(r, 500));
	const id2 = await fetch(idUrl).then((r) => r.text());
	expect(id2).toEqual(id1);
}, 10_000);
