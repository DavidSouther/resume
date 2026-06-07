// Test-only helper: mount a jiffies-rendered node (or fragment) into a fresh
// container attached to document.body, so @testing-library/dom queries can run
// against it. Pair with `resetDom()` in an afterEach. Conditional/absent
// children (null/undefined/false) are dropped here, mirroring how the real tag
// functions filter them when a fragment is spread into a parent element.
import { CLEAR, type DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";

export function mount(node: DenormChildren | DenormChildren[]): HTMLElement {
	const container = document.createElement("div");
	const nodes = (Array.isArray(node) ? node : [node]).filter(
		(n): n is Node | string => n != null && n !== false && n !== CLEAR,
	);
	container.append(...nodes);
	document.body.append(container);
	return container;
}

export function resetDom(): void {
	document.body.innerHTML = "";
}
