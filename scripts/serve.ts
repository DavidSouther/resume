import { spawn } from "node:child_process";
import { join } from "node:path";
import { cwd } from "node:process";
import { parseArgs } from "node:util";
import { makeServer } from "@davidsouther/jiffies/server/http/index.ts";
import {
	ignoreDefault,
	jiffiesArgs,
	startWatchServer,
} from "@davidsouther/jiffies/server/live-reload.ts";

// Serves the built static site in docs/ over HTTP using the jiffies server's
// static-file + directory-index middleware, so clean URLs like /blog/ resolve
// to /blog/index.html. Run after `npm run build`. Override with
// `npm start -- --port 3000 --host 0.0.0.0`.
//
// With `--watch`, builds first, then rebuilds (`npm run dev`) on edits to
// pages/, src/, public/ and live-reloads connected browsers. The watch loop,
// WS hub, and client snippet live in @davidsouther/jiffies; this entrypoint
// owns only the resume-specific build command and generated-output ignores.
// See .agents/developer/2026-06-10-A-upstream-livereload-client/design.md.

const RELOAD_PATH = "/__livereload";

// Runs the content build in a fresh node process (avoids the stale ESM module
// cache that would otherwise re-serve old page modules). Resolves true on exit 0.
function runDevBuild(dir: string): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn("npm", ["run", "dev"], { cwd: dir, stdio: "inherit" });
		child.on("exit", (code) => resolve(code === 0));
		child.on("error", () => resolve(false));
	});
}

const { values } = parseArgs({ options: jiffiesArgs({ host: "127.0.0.1" }) });

const port = Number.parseInt(values.port, 10);
const root = join(cwd(), "docs");

if (values.watch) {
	// public/global.css (css:bundle) and public/sitemap.xml (sitemap) are build
	// outputs written back into public/. Excluding them stops the build from
	// retriggering itself in an endless rebuild + reload loop.
	const generated = new Set([
		join(cwd(), "public", "global.css"),
		join(cwd(), "public", "sitemap.xml"),
	]);
	await startWatchServer({
		root,
		watchDirs: [
			join(cwd(), "pages"),
			join(cwd(), "src"),
			join(cwd(), "public"),
		],
		rebuild: () => runDevBuild(cwd()),
		ignore: (file) => generated.has(file) || ignoreDefault(file),
		reloadPath: RELOAD_PATH,
		port,
		host: values.host,
	});
	process.stderr.write(
		"watch: rebuilding on changes in pages/, src/, public/; browsers live-reload\n",
	);
} else {
	const server = await makeServer({ root });
	server.listen(port, values.host);
}
