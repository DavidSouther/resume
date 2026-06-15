// Shared write step for the build-time TS-literal generators
// (update-ephemeris-snapshot.ts, render-guilloche.ts).
//
// Each generator serializes a TS literal, but `npm run check` lints src/ with
// Biome, which has its own object-literal/quote/line-width conventions a hand-rolled
// serializer cannot reliably match (unquoted keys, trailing commas, long-string
// handling). So instead of guessing Biome's exact output, the generators write the
// file and then run Biome's own formatter over it — the same binary `npm run check`
// uses — guaranteeing the committed literal is Biome-clean regardless of payload.
//
// This is an entry-point-only side effect (called from the generators' import.meta.main
// blocks), so it does NOT break the purity invariant the feature tests assert: the
// pure builder/serializer functions stay write-free.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Write `contents` to `path`, then format it in place with the project's Biome so
 *  the generated TS is lint-clean for `npm run check`. */
export function writeGenerated(path: string, contents: string): void {
	writeFileSync(path, contents, "utf-8");
	const biome = join(
		import.meta.dirname,
		"..",
		"node_modules",
		".bin",
		"biome",
	);
	execFileSync(biome, ["format", "--write", path], { stdio: "inherit" });
}
