import {
	div,
	figure,
	h1,
	h2,
	script,
	section,
	style,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { Layout } from "../../../../src/components/layout.ts";
import { toHTML } from "../../../../src/lib/markdown.ts";
import { pageHead } from "../../../../src/lib/page-head.ts";
import { loadContent } from "./content.ts";
import { buildStages } from "./dataset.ts";
import { narrate } from "./narrate.ts";
import { buildKeyframes } from "./plan.ts";
import { loadStaffingCsv } from "./staffing.ts";
import { data, renderControls, renderStage } from "./viewer.ts";

// Page role: the server renders keyframe 0 and every narration step (text from
// content.md); the
// client module (normalization/client.ts) takes over stepping and animation.

const CSS = `
.root.nf-root > header { display: block; }
/* overflow: visible is required for position: sticky on #nf-figure. */
.nf-root main { overflow: visible; }
.nf-page { max-width: 72rem; margin: 0 auto; padding: 0 1rem 40vh; }
#nf-figure { position: sticky; top: 0; z-index: 2; margin: 0; padding: 0.5rem 0; background: Canvas; color: CanvasText; border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent); }
.nf-spacer { flex: 1 1 0; }
.nf-controls { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
.nf-controls button[aria-current="true"] { outline: 2px solid currentColor; }
/* client.ts measures #nf-figure (controls plus this 40vh canvas) to place the observer band and snap offset. */
.nf-canvas { position: relative; max-height: 40vh; overflow: auto; }
.nf-stage { display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; align-items: flex-start; }
.nf-table { margin: 0; }
.nf-table h3 { margin: 0 0 0.2rem; font-size: 0.85rem; }
.nf-table table { border-collapse: collapse; font-size: 0.72rem; width: auto; }
.nf-table th, .nf-table td { border: 1px solid color-mix(in srgb, currentColor 25%, transparent); padding: 0.1rem 0.4rem; white-space: nowrap; text-align: left; background: Canvas; transition: background-color 0.4s; }
.nf-table th.key { text-decoration: underline; }
.nf-table [data-null="true"] { color: color-mix(in srgb, CanvasText 70%, Canvas); font-style: italic; }
.nf-table .violates { background: color-mix(in srgb, #e0a000 35%, Canvas); }
.nf-ghost { position: absolute; z-index: 1; font-size: 0.72rem; padding: 0.1rem 0.4rem; background: color-mix(in srgb, #e0a000 35%, Canvas); box-sizing: border-box; white-space: nowrap; overflow: hidden; pointer-events: none; }
/* Each step is a tall scroll segment (overflow: visible so it is not the sticky scroll container). Its card sticks just below the figure for the whole segment, then the next step snaps in. --nf-fig-h is the sticky figure's height, set by client.ts. */
/* client.ts adds .nf-snap only once the first step has reached the figure, so the header text above it stays freely scrollable. */
html.nf-snap:has(.nf-root) { scroll-snap-type: y proximity; }
.nf-step { overflow: visible; display: block; min-height: 75vh; margin: 0; padding: 0; border: 0; box-shadow: none; background: none; scroll-snap-align: start; scroll-margin-top: var(--nf-fig-h, 50vh); }
.nf-card { position: sticky; top: calc(var(--nf-fig-h, 50vh) + 0.75rem); padding: 1rem; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: 0.5rem; background: Canvas; opacity: 0.45; transition: opacity 0.3s; }
.nf-step.active .nf-card { opacity: 1; }
.nf-card h2 { margin: 0 0 0.25rem; }
.nf-hint { font-size: 0.8rem; opacity: 0.7; }
@media (prefers-reduced-motion: reduce) { .nf-card, .nf-table th, .nf-table td { transition: none; } }
`;

export default {
	head: () => [
		...pageHead("Normal Forms, as Data — David Souther"),
		style({}, CSS),
	],
	default: () => {
		const csv = loadStaffingCsv();
		const stages = buildStages(csv);
		const content = loadContent();
		const frames = buildKeyframes(stages);
		const narration = narrate(stages, frames, content);
		const canvas = div({ class: "nf-canvas" }, renderStage(stages[0]));
		canvas.setAttribute("tabindex", "0");
		canvas.setAttribute("role", "region");
		canvas.setAttribute("aria-label", "Table data");
		return Layout(
			{
				lastUpdate: new Date().toISOString(),
				class: "nf-root",
				header: [
					h1(content.title),
					Object.assign(div(), { innerHTML: toHTML(content.intro) }),
				],
			},
			div(
				{ class: "nf-page" },
				data(figure({ id: "nf-figure" }, renderControls(frames), canvas), {
					keyframe: "0",
				}),
				// The browser bundle rebuilds every stage from this same text.
				script({ type: "text/csv", id: "nf-data" }, csv),
				...frames.map((f) =>
					data(
						section(
							{ class: "nf-step" },
							div(
								{ class: "nf-card" },
								h2(narration[f.index].title),
								Object.assign(div(), {
									innerHTML: toHTML(narration[f.index].text),
								}),
								f.kind === "violates"
									? div({ class: "nf-hint" }, "Next: watch these values move.")
									: null,
							),
						),
						{ keyframe: String(f.index), stepId: f.id },
					),
				),
			),
		);
	},
	clientModules: ["/pages/course/cisc_7510/normal_forms/client.ts"],
} satisfies PageModule;
