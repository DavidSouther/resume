import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { RELOAD_PATH, startWatchServer } from "./live-reload.ts";

// User story: running `npm start -- --watch`, saving an edit to a watched
// source file reloads the open browser. Exercised browser-free: the reload is
// now driven by a WebSocket push (not HTTP polling). The two contracts that
// cause the reload are (1) pages carry the WebSocket client snippet, and
// (2) editing a watched file pushes a reload message over a real WebSocket.

let cleanup: (() => Promise<void>) | undefined;
const openSockets: WebSocket[] = [];

afterEach(async () => {
	for (const ws of openSockets.splice(0)) {
		try {
			ws.close();
		} catch {}
	}
	await cleanup?.();
	cleanup = undefined;
});

// Opens a client WebSocket to the watch server's reload path and resolves once
// it is open. Rejects fast on error or after `timeoutMs` so a missing upgrade
// endpoint fails the test instead of hanging. Tracked for afterEach teardown.
function connectReloadSocket(
	port: number,
	timeoutMs = 4000,
): Promise<WebSocket> {
	const ws = new WebSocket(`ws://127.0.0.1:${port}${RELOAD_PATH}`);
	openSockets.push(ws);
	return new Promise<WebSocket>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`WebSocket did not open within ${timeoutMs}ms`));
		}, timeoutMs);
		ws.addEventListener("open", () => {
			clearTimeout(timer);
			resolve(ws);
		});
		ws.addEventListener("error", () => {
			clearTimeout(timer);
			reject(new Error("WebSocket connection errored before opening"));
		});
	});
}

it("pages carry the WebSocket reload snippet and an edit pushes a reload over the socket", async () => {
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
		debounceMs: 20,
		port: 0,
		host: "127.0.0.1",
	});
	cleanup = server.close;

	// (1) Pages carry the WebSocket client snippet that drives the reload.
	const page = await fetch(`http://127.0.0.1:${server.port}/`).then((r) =>
		r.text(),
	);
	expect(page).toContain(RELOAD_PATH);
	expect(page).toContain("new WebSocket");
	expect(page).toMatch(/location\.reload/);

	// (2) Open a real client WebSocket and record any pushed message.
	const ws = await connectReloadSocket(server.port);
	const received = await new Promise<string>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("no reload message pushed within 4000ms"));
		}, 4000);
		ws.addEventListener("message", (event) => {
			clearTimeout(timer);
			resolve(String((event as MessageEvent).data));
		});
		// Save an edit to a watched file after the handler is attached.
		writeFile(join(src, "page.ts"), "export const x = 2;\n").catch(reject);
	});

	// A message arrived, so an open browser would have reloaded.
	expect(received.length).toBeGreaterThan(0);
}, 10_000);

it("a build that writes into a watched dir pushes exactly one reload (no reload loop)", async () => {
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

	// Count every reload message pushed over the socket.
	const ws = await connectReloadSocket(server.port);
	let messages = 0;
	ws.addEventListener("message", () => {
		messages += 1;
	});

	// One real edit to a non-ignored file pushes exactly one reload.
	await writeFile(join(src, "page.ts"), "export const x = 2;\n");
	const deadline = Date.now() + 3000;
	while (Date.now() < deadline) {
		if (messages >= 1) break;
		await new Promise((r) => setTimeout(r, 25));
	}
	expect(messages).toBe(1);

	// The rebuild wrote the ignored generated file. If that retriggered the
	// build, another reload would be pushed; assert none arrives in a settle
	// window. Exactly one message per real edit, none from the ignored write.
	await new Promise((r) => setTimeout(r, 500));
	expect(messages).toBe(1);
}, 10_000);
