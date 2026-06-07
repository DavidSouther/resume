import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// node is the default; component suites opt into jsdom per-file via the
		// `// @vitest-environment jsdom` docblock. This keeps Node-only lib tests
		// (fs access in posts.ts) fast and avoids a deprecated environmentMatchGlobs.
		environment: "node",
	},
});
