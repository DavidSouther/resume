// The browser bundle starts at client.ts. Anything it reaches that imports a
// node: module (fs, path) fails to load in the page, which no jsdom test sees.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";

function graph(entry: string, seen = new Set<string>()): Set<string> {
	if (seen.has(entry)) return seen;
	seen.add(entry);
	const source = readFileSync(entry, "utf-8");
	for (const m of source.matchAll(/(?:from|import)\s+"(\.[^"]+\.ts)"/g))
		graph(join(dirname(entry), m[1]), seen);
	return seen;
}

it("client.ts reaches no node: imports", () => {
	const files = graph(join(import.meta.dirname, "client.ts"));
	expect(files.size).toBeGreaterThan(3);
	for (const file of files)
		expect(readFileSync(file, "utf-8"), file).not.toMatch(/from "node:/);
});
