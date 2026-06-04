import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	// Resolve the ~/* alias from tsconfig.json natively. Vite supports this
	// directly, so no vite-tsconfig-paths plugin is needed.
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		// node is the default; component suites opt into jsdom per-file via the
		// `// @vitest-environment jsdom` docblock. This keeps Node-only lib tests
		// (fs access in posts.ts) fast and avoids a deprecated environmentMatchGlobs.
		environment: "node",
	},
});
