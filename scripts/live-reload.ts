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

// Live-reload pieces for `npm start -- --watch`. Deliberately shaped as stock
// jiffies middlewares + a generic watcher so the whole feature can later move
// into jiffies' server CLI with no change to the makeServer contract. See
// .agents/developer/2026-06-07-B-start-watch-livereload/design.md.

export const RELOAD_PATH = "/__livereload";

// The injected client snippet polls the build id and reloads when it changes.
// On the first response it only records the id (no reload), so a freshly loaded
// page does not bounce. RELOAD_PATH is JSON-encoded here (not at the constant)
// because buildIdServer compares it raw against an unquoted request pathname.
export function reloadClientSnippet(intervalMs: number): string {
	return `<script>(function(){let last=null;async function poll(){try{const r=await fetch(${JSON.stringify(
		RELOAD_PATH,
	)},{cache:"no-store"});const id=await r.text();if(last!==null&&id!==last){location.reload();return;}last=id;}catch(e){}setTimeout(poll,${intervalMs});}poll();})();</script>`;
}

// Serves the current build id at RELOAD_PATH; passes everything else through.
export const buildIdServer =
	(getId: () => string): MiddlewareFactory =>
	async () =>
	async (req) => {
		const { pathname } = new URL(req.url ?? "/", "http://localhost");
		if (pathname === RELOAD_PATH) {
			return contentResponse(
				getId(),
				"text/plain",
				200,
				new Map([["cache-control", "no-store"]]),
			);
		}
		return undefined;
	};

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

// Holds the build id and serializes rebuilds: a change during a build sets a
// dirty flag that triggers exactly one more rebuild afterward.
export function createRebuilder(rebuild: () => Promise<boolean>): {
	id: () => string;
	run: () => Promise<void>;
	trigger: () => void;
} {
	let id = 0;
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
				if (await rebuild()) id += 1;
			} while (dirty);
		} finally {
			building = false;
		}
	};
	return { id: () => String(id), run, trigger: () => void run() };
}

export interface WatchServerOptions {
	root: string;
	watchDirs: string[];
	rebuild: () => Promise<boolean>;
	reloadIntervalMs?: number;
	debounceMs?: number;
	// Resolved paths to exclude from watching (e.g. build outputs written back
	// into a watched dir). Defaults to ignoreDefault when omitted.
	ignore?: (file: string) => boolean;
	port?: number;
	host?: string;
}

// Initial build, then serve `root` with the build-id + injector middlewares and
// watch `watchDirs`. Returns the bound port and a close() for clean shutdown.
export async function startWatchServer(
	opts: WatchServerOptions,
): Promise<{ port: number; close: () => Promise<void> }> {
	const rebuilder = createRebuilder(opts.rebuild);
	await rebuilder.run();
	const snippet = reloadClientSnippet(opts.reloadIntervalMs ?? 500);
	const server = await makeServer({ root: opts.root }, [
		buildIdServer(rebuilder.id),
		htmlInjector(snippet),
	]);
	const watcher = watchTree(opts.watchDirs, rebuilder.trigger, {
		debounceMs: opts.debounceMs,
		ignore: opts.ignore,
	});
	await new Promise<void>((resolve) =>
		server.listen(opts.port ?? 8080, opts.host ?? "127.0.0.1", resolve),
	);
	const address = server.address() as AddressInfo;
	return {
		port: address.port,
		close: () =>
			new Promise<void>((resolve) => {
				watcher.close();
				server.close(() => resolve());
			}),
	};
}
