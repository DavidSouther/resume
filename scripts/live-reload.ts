import { spawn } from "node:child_process";
import { type FSWatcher, watch } from "node:fs";
import * as fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import * as path from "node:path";
import {
	type MiddlewareFactory,
	makeServer,
} from "@davidsouther/jiffies/server/http/index.ts";
import { contentResponse } from "@davidsouther/jiffies/server/http/response.ts";
import {
	attachWebSocketServer,
	type WebSocketHub,
} from "@davidsouther/jiffies/server/ws/index.ts";

// Live-reload pieces for `npm start -- --watch`. Deliberately shaped as stock
// jiffies middlewares + a generic watcher so the whole feature can later move
// into jiffies' server CLI with no change to the makeServer contract. See
// .agents/developer/2026-06-07-B-start-watch-livereload/design.md.

export const RELOAD_PATH = "/__livereload";

// The injected client snippet opens a WebSocket to RELOAD_PATH and reloads the
// page on any pushed message. On close it reconnects with a short fixed backoff,
// which recovers from a server restart or a socket dropped during a rebuild.
// Errors are swallowed; the close handler drives the reconnect.
export function reloadClientSnippet(): string {
	return `<script>(function(){function connect(){var ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+${JSON.stringify(
		RELOAD_PATH,
	)});ws.onmessage=function(){location.reload();};ws.onerror=function(){};ws.onclose=function(){setTimeout(connect,1000);};}connect();})();</script>`;
}

// Injects the reload snippet into HTML navigations. Mirrors jiffies findIndex
// (walk up for index.html) for extensionless paths; serves .html directly.
// Asset/CSS/TS requests fall through to the base middlewares.
export const htmlInjector =
	(snippet: string): MiddlewareFactory =>
	async ({ root }) =>
	async (req) => {
		const { pathname } = new URL(req.url ?? "/", "http://localhost");
		const decoded = decodeURIComponent(pathname);
		const ext = path.extname(decoded);
		let target: string | undefined;
		if (ext === ".html") {
			target = path.join(root, decoded);
		} else if (ext === "") {
			let dir = path.join(root, decoded);
			while (dir.startsWith(root)) {
				const idx = path.join(dir, "index.html");
				try {
					if ((await fs.stat(idx)).isFile()) {
						target = idx;
						break;
					}
				} catch {}
				dir = path.dirname(dir);
			}
		}
		if (!target) return undefined;
		try {
			if (!(await fs.stat(target)).isFile()) return undefined;
			const html = await fs.readFile(target, "utf-8");
			const injected = html.includes("</body>")
				? html.replace("</body>", `${snippet}</body>`)
				: html + snippet;
			return contentResponse(injected, "text/html");
		} catch {
			return undefined;
		}
	};

// Ignores dotfiles and node_modules. The argument is the full resolved path, so
// callers can compose this with project-specific generated-output paths.
export const ignoreDefault = (file: string): boolean =>
	/(^|[\\/])\./.test(file) || file.includes("node_modules");

// Watches dirs recursively, coalescing bursts into a single trailing call. The
// ignore predicate receives the resolved absolute path of each changed file, so
// it can exclude build outputs written back into a watched dir (which would
// otherwise retrigger the build endlessly).
export function watchTree(
	dirs: string[],
	onChange: () => void,
	{
		debounceMs = 150,
		ignore = ignoreDefault,
	}: { debounceMs?: number; ignore?: (file: string) => boolean } = {},
): { close: () => void } {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const watchers: FSWatcher[] = [];
	for (const dir of dirs) {
		try {
			watchers.push(
				watch(dir, { recursive: true }, (_event, filename) => {
					if (!filename) return;
					if (ignore(path.join(dir, filename.toString()))) return;
					if (timer) clearTimeout(timer);
					timer = setTimeout(onChange, debounceMs);
				}),
			);
		} catch {
			// Directory may not exist; skip it.
		}
	}
	return {
		close: () => {
			if (timer) clearTimeout(timer);
			for (const w of watchers) w.close();
		},
	};
}

// Runs the content build in a fresh node process (avoids the stale ESM module
// cache that would otherwise re-serve old page modules). Resolves true on exit 0.
export function runDevBuild(cwd: string): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn("npm", ["run", "dev"], { cwd, stdio: "inherit" });
		child.on("exit", (code) => resolve(code === 0));
		child.on("error", () => resolve(false));
	});
}

// Serializes rebuilds: a change during a build sets a dirty flag that triggers
// exactly one more rebuild afterward. `onBuilt` runs once per successful rebuild
// (each time the inner rebuild resolves true), letting the caller broadcast a
// reload without the client needing a queryable build id.
export function createRebuilder(
	rebuild: () => Promise<boolean>,
	onBuilt?: () => void,
): {
	run: () => Promise<void>;
	trigger: () => void;
} {
	let building = false;
	let dirty = false;
	const run = async (): Promise<void> => {
		if (building) {
			dirty = true;
			return;
		}
		building = true;
		try {
			do {
				dirty = false;
				if (await rebuild()) onBuilt?.();
			} while (dirty);
		} finally {
			building = false;
		}
	};
	return { run, trigger: () => void run() };
}

export interface WatchServerOptions {
	root: string;
	watchDirs: string[];
	rebuild: () => Promise<boolean>;
	debounceMs?: number;
	// Resolved paths to exclude from watching (e.g. build outputs written back
	// into a watched dir). Defaults to ignoreDefault when omitted.
	ignore?: (file: string) => boolean;
	port?: number;
	host?: string;
}

// Initial build, then serve `root` with the injector middleware, attach a
// WebSocket hub at RELOAD_PATH, and watch `watchDirs`. Each successful rebuild
// broadcasts "reload" to connected clients. Returns the bound port and a
// close() for clean shutdown. The hub is late-bound: the initial build runs
// before it exists, so its onBuilt broadcast is a no-op (no clients yet).
export async function startWatchServer(
	opts: WatchServerOptions,
): Promise<{ port: number; close: () => Promise<void> }> {
	let hub: WebSocketHub | undefined;
	const rebuilder = createRebuilder(opts.rebuild, () =>
		hub?.broadcast("reload"),
	);
	await rebuilder.run();
	const snippet = reloadClientSnippet();
	const server = await makeServer({ root: opts.root }, [htmlInjector(snippet)]);
	const watcher = watchTree(opts.watchDirs, rebuilder.trigger, {
		debounceMs: opts.debounceMs,
		ignore: opts.ignore,
	});
	await new Promise<void>((resolve) =>
		server.listen(opts.port ?? 8080, opts.host ?? "127.0.0.1", resolve),
	);
	hub = attachWebSocketServer(server, { path: RELOAD_PATH });
	const address = server.address() as AddressInfo;
	return {
		port: address.port,
		close: () =>
			new Promise<void>((resolve) => {
				hub?.close();
				watcher.close();
				server.close(() => resolve());
			}),
	};
}
