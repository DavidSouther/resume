// Loaded on every /blog/<id>/ page (see pages/blog/[id]/page.ts). No-ops
// immediately when the post has no `.slide-deck` (the common case), so it's
// safe to ship unconditionally rather than threading a per-post clientModules
// list through the SSG's static PageModule shape.

const MERMAID_URL =
	"https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.esm.min.mjs";

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

// Read the deck's already-themed Jiffies tokens (they already respond to
// data-theme and prefers-color-scheme) so mermaid's diagram matches the
// current brand theme and stays legible in every one, instead of mermaid's
// own default white-box theme, which has fixed contrast that fights the
// page's own light/dark background and reads as unstyled/foreign code.
//
// Jiffies' color tokens use relative `oklch(from ...)` syntax, which
// getComputedStyle only resolves to a plain rgb() once it's the *used value*
// of an actual color property (not when just reading the custom property
// itself) — hence bouncing each token through a probe element's `color`.
function themeVariablesFrom(deck: HTMLElement): Record<string, string> {
	const probe = document.createElement("span");
	probe.style.display = "none";
	deck.appendChild(probe);

	// Computed style serializes color back out in whatever color space it was
	// specified in (oklch, for Jiffies' tokens) — even relative-color tricks
	// like `rgb(from ...)` still come back as a `color(srgb ...)` function
	// once components are non-integer — and khroma (mermaid's color library)
	// only parses hex/rgb()/hsl(). Painting the resolved color onto a 1x1
	// canvas and reading the pixel back always yields concrete 8-bit sRGB,
	// regardless of what color space it was specified in.
	const canvas = document
		.createElement("canvas")
		.getContext("2d", { willReadFrequently: true });
	const resolveColor = (name: string): string => {
		probe.style.color = `var(${name})`;
		const resolved = getComputedStyle(probe).color;
		if (!canvas) return resolved;
		canvas.fillStyle = resolved;
		canvas.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
		return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
	};

	const variables: Record<string, string> = {
		background: resolveColor("--color-surface"),
		primaryColor: resolveColor("--color-surface-variant"),
		primaryTextColor: resolveColor("--color-on-surface"),
		primaryBorderColor: resolveColor("--color-outline"),
		lineColor: resolveColor("--color-outline"),
		textColor: resolveColor("--color-on-surface"),
		fontFamily: getComputedStyle(deck)
			.getPropertyValue("--base-body-font-family")
			.trim(),
	};

	probe.remove();
	for (const key of Object.keys(variables)) {
		if (variables[key] === "") delete variables[key];
	}
	return variables;
}

async function renderMermaid(deck: HTMLElement): Promise<void> {
	const blocks = deck.querySelectorAll<HTMLElement>(
		"pre > code.language-mermaid",
	);
	if (blocks.length === 0) return;

	const { default: mermaid } = await import(MERMAID_URL);
	mermaid.initialize({
		startOnLoad: false,
		theme: "base",
		themeVariables: themeVariablesFrom(deck),
	});

	blocks.forEach((code) => {
		const graph = document.createElement("div");
		graph.className = "mermaid";
		graph.textContent = code.textContent ?? "";
		code.closest("pre")?.replaceWith(graph);
	});

	await mermaid.run({ querySelector: ".mermaid" });
}

function main(): void {
	const deck = document.querySelector<HTMLElement>(".slide-deck");
	if (!deck) return;
	renderMermaid(deck).finally(() => setUpDeck(deck));
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", main);
} else {
	main();
}
