import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";

// This test lives in scripts/, so the repo root is one directory up.
const ROOT = join(import.meta.dirname, "..");

// Parse the leading integer major out of a version string. mise pins major-only
// ("24"); engines.node is a range with a leading comparator (">=24"). Strip a
// leading ">=", "^", "~", or "v" then read the first run of digits. Returns NaN
// when no leading major integer is present. Kept deliberately minimal: the
// declarations under test are both simple, and no semver library is a dependency.
function leadingMajor(version: string): number {
	const stripped = version.trim().replace(/^(>=|<=|>|<|\^|~|v)/, "");
	const match = stripped.match(/^(\d+)/);
	return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

describe("mise provisions a Node that satisfies package.json engines.node", () => {
	it("mise.toml exists and parses as TOML", () => {
		const raw = readFileSync(join(ROOT, "mise.toml"), "utf-8");
		expect(() => parse(raw)).not.toThrow();
	});

	it("declares tools.node as a non-empty string", () => {
		const config = parse(readFileSync(join(ROOT, "mise.toml"), "utf-8")) as {
			tools?: { node?: unknown };
		};
		const node = config.tools?.node;
		expect(typeof node, "tools.node must be a string").toBe("string");
		expect(
			(node as string).trim().length,
			"tools.node must be non-empty",
		).toBeGreaterThan(0);
	});

	it("mise tools.node major satisfies package.json engines.node floor", () => {
		const config = parse(readFileSync(join(ROOT, "mise.toml"), "utf-8")) as {
			tools: { node: string };
		};
		const pkg = JSON.parse(
			readFileSync(join(ROOT, "package.json"), "utf-8"),
		) as { engines: { node: string } };

		const miseMajor = leadingMajor(config.tools.node);
		const enginesMin = leadingMajor(pkg.engines.node);

		// Both must resolve to a real integer major before they can be compared.
		expect(
			Number.isInteger(miseMajor),
			`could not parse a major integer from mise tools.node="${config.tools.node}"`,
		).toBe(true);
		expect(
			Number.isInteger(enginesMin),
			`could not parse a major integer from engines.node="${pkg.engines.node}"`,
		).toBe(true);

		// The mise pin must not declare a Node older than the engines floor, or a
		// mise-only contributor would get a Node npm rejects.
		expect(
			miseMajor,
			`mise tools.node=${config.tools.node} (major ${miseMajor}) is below engines.node=${pkg.engines.node} (floor ${enginesMin})`,
		).toBeGreaterThanOrEqual(enginesMin);
	});
});
