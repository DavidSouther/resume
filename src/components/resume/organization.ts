import { a, h4 } from "@davidsouther/jiffies/dom/html.ts";
import type * as ResumeTypes from "../../lib/resume";

// Renders an organization heading, linked when the entity has a URL.
export function Organization(
	org: ResumeTypes.PublicEntityDetails,
): HTMLElement {
	return h4(
		{ class: "organization" },
		org.URL ? a({ href: org.URL }, org.name) : org.name,
	);
}
