import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";

// stub — replaced in Step 5. generateStaticParams returns [] so the SSG
// discovers the dynamic sentinel without emitting any concrete pages yet.
export default {
	generateStaticParams: async () => [],
	head: () => [],
	default: async () => window.document.createElement("div"),
} satisfies PageModule;
