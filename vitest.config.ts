import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// node is the default; component suites opt into jsdom per-file via the
		// `// @vitest-environment jsdom` docblock. This keeps Node-only lib tests
		// (fs access in posts.ts) fast and avoids a deprecated environmentMatchGlobs.
		environment: "node",
		// Builds docs/ once; feature tests read it rather than each running the build.
		globalSetup: ["./scripts/vitest-build.ts"],
	},
});
