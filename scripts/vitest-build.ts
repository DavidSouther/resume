// Vitest global setup: build the site once so feature tests read docs/ instead
// of each running `npm run build`. Set SKIP_SITE_BUILD=1 when a prior step has
// already built docs/ (CI does).
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

export default function setup(): void {
	if (process.env.SKIP_SITE_BUILD === "1") return;
	const result = spawnSync("npm", ["run", "build"], {
		cwd: ROOT,
		encoding: "utf-8",
	});
	if (result.status !== 0) {
		throw new Error(`Build failed (exit ${result.status}):\n${result.stderr}`);
	}
}
