// Controls-sheet registration — F1 OWNS this registry (project-plan Contract 2).
//
// Every astrolabe feature contributes its controls and #debug panels through
// `registerControlsSection`; `ControlsSheet()` renders the registered sections,
// gating `debugOnly` sections behind the `#debug` URL hash.
//
// The registry is module-level ordered state: sections render in registration
// order, and re-registering an existing id replaces it in place (idempotent on
// id) so a feature re-rendering its shell never duplicates its panels.
import { toChildren } from "@davidsouther/jiffies/components/children.ts";
import { Accordion, Card } from "@davidsouther/jiffies/components/index.ts";
import { div } from "@davidsouther/jiffies/dom/html.ts";

/** A contributed controls/debug section. Sections render in registration order. */
export interface ControlsSection {
	id: string;
	title: string;
	render(): Node | Node[];
	debugOnly: boolean;
}

/** The stable hook the client toggle re-mounts the sheet into on hashchange. */
export const CONTROLS_HOST_ATTR = "data-astrolabe-controls";

const registry: ControlsSection[] = [];

/** Append a section to the registry. Sections render in registration order; idempotent on id. */
export function registerControlsSection(section: ControlsSection): void {
	const index = registry.findIndex((s) => s.id === section.id);
	if (index >= 0) {
		registry[index] = section;
	} else {
		registry.push(section);
	}
}

/** Build the controls sheet; debugOnly sections appear only with the #debug hash. */
export function ControlsSheet(): Element {
	const debug = window.location.hash === "#debug";
	const sections = registry
		.filter((section) => !section.debugOnly || debug)
		.map((section) =>
			Accordion({ summary: section.title }, ...toChildren(section.render())),
		);
	return Card({}, ...sections);
}

/**
 * The stable host wrapping the controls sheet. The SSG bakes the first sheet in
 * (always-visible sections, first paint carries content); the client toggle
 * (controls-client.ts) replaces the host's contents from the current hash on load
 * and on `hashchange`, so `#debug` sections appear without a page rebuild.
 */
export function ControlsHost(): Element {
	const host = div({ class: "astrolabe-controls" }, ControlsSheet());
	host.setAttribute(CONTROLS_HOST_ATTR, "");
	return host;
}

/**
 * Re-render the controls sheet into the host from the current `#debug` hash.
 * The client toggle calls this on load and on every `hashchange`; gating that the
 * SSG decided once at build time is re-decided live in the browser here.
 */
export function refreshControlsHost(host: Element): void {
	host.replaceChildren(ControlsSheet());
}
