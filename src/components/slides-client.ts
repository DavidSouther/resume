// Loaded on every /blog/<id>/ page (see pages/blog/[id]/page.ts). No-ops
// immediately when the post has no `.slide-deck` (the common case), so it's
// safe to ship unconditionally rather than threading a per-post clientModules
// list through the SSG's static PageModule shape.
//
// Mermaid diagrams inside a deck are booted by the shared
// src/components/mermaid/client.ts (also loaded on every post page) — this
// module only owns slide navigation.

function slideIndexFromHash(count: number): number {
	const match = /^#slide-(\d+)$/.exec(location.hash);
	if (!match) return 0;
	const index = Number(match[1]) - 1;
	return index >= 0 && index < count ? index : 0;
}

function setUpDeck(deck: HTMLElement): void {
	const slides = Array.from(
		deck.querySelectorAll<HTMLElement>(":scope > .slide"),
	);
	if (slides.length === 0) return;

	deck.classList.add("slide-deck-active");
	deck.tabIndex = -1;
	deck.focus();

	let current = slideIndexFromHash(slides.length);

	function show(index: number): void {
		current = Math.max(0, Math.min(index, slides.length - 1));
		slides.forEach((slide, i) => {
			slide.hidden = i !== current;
		});
		history.replaceState(null, "", `#slide-${current + 1}`);
	}

	deck.addEventListener("click", (event) => {
		if ((event.target as HTMLElement).closest("a")) return;
		show(current + 1);
	});

	deck.addEventListener("keydown", (event) => {
		switch (event.key) {
			case "ArrowRight":
			case "ArrowDown":
			case "PageDown":
			case " ":
				event.preventDefault();
				show(current + 1);
				break;
			case "ArrowLeft":
			case "ArrowUp":
			case "PageUp":
				event.preventDefault();
				show(current - 1);
				break;
			case "f":
				deck.requestFullscreen?.();
				break;
			case "Escape":
				if (document.fullscreenElement) document.exitFullscreen();
				break;
		}
	});

	show(current);
}

function main(): void {
	const deck = document.querySelector<HTMLElement>(".slide-deck");
	if (!deck) return;
	setUpDeck(deck);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", main);
} else {
	main();
}
