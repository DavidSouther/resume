import { readFileSync } from "node:fs";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { MD } from "../../src/components/p.ts";
import { pageHead } from "../../src/lib/page-head.ts";

export default {
	head: () => pageHead("David Souther CV"),
	default: async () => MD(readFileSync("content/cv-suny-downstate.md", 'utf-8')),
} satisfies PageModule;
