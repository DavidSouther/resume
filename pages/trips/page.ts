import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";

// stub — replaced in Step 5
export default {
	head: () => [],
	default: async () => window.document.createElement("div"),
} satisfies PageModule;
