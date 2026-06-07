import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";

// stub — replaced in Step 3 (re-exports pages/home.ts)
export default {
	head: () => [],
	default: async () => window.document.createElement("div"),
} satisfies PageModule;
