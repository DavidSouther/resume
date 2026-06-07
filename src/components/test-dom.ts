// Test-only helper: mount a jiffies-rendered node (or fragment) into a fresh
// container attached to document.body, so @testing-library/dom queries can run
// against it. Pair with `resetDom()` in an afterEach.
export function mount(node: Node | Node[]): HTMLElement {
	const container = document.createElement("div");
	container.append(...(Array.isArray(node) ? node : [node]));
	document.body.append(container);
	return container;
}

export function resetDom(): void {
	document.body.innerHTML = "";
}
