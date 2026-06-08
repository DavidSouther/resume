import { join } from "node:path";
import { cwd } from "node:process";
import { parseArgs } from "node:util";
import { makeServer } from "@davidsouther/jiffies/server/http/index.ts";
import { ignoreDefault, runDevBuild, startWatchServer } from "./live-reload.ts";

// Serves the built static site in docs/ over HTTP using the jiffies server's
// static-file + directory-index middleware, so clean URLs like /blog/ resolve
// to /blog/index.html. Run after `npm run build`. Override with
// `npm start -- --port 3000 --host 0.0.0.0`.
//
// With `--watch`, builds first, then rebuilds (`npm run dev`) on edits to
// pages/, src/, public/ and live-reloads connected browsers. See
// .agents/developer/2026-06-07-B-start-watch-livereload/design.md.
const { values } = parseArgs({
	options: {
		port: { type: "string", default: "8080" },
		host: { type: "string", default: "127.0.0.1" },
		watch: { type: "boolean", default: false },
	},
});

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
