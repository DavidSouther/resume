// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { toHTML } from "./markdown.ts";

describe("semantic highlight gutters", () => {
	it("keeps an unmarked source fence paired with its trace diagram", () => {
		const html = toHTML(`\`\`\`highlight-gutters
code rust:
fn build_art() {
    let art = artwork();
}
\`\`\`
\`\`\`mermaid
traceDiagram
  frame build_art
    art: Artwork
  end
\`\`\`
`);
		document.body.innerHTML = html;

		const gutter = document.querySelector<HTMLElement>(".highlight-gutters");
		expect(gutter?.style.getPropertyValue("--gutter-lanes")).toBe("0");
		expect(gutter?.querySelectorAll("[data-gutter-band]")).toHaveLength(0);
		expect(document.querySelector("pre.mermaid")?.textContent).toContain(
			"traceDiagram",
		);
	});

	it("renders copies, shared references, and exclusive mutable references from one fence", () => {
		const html = toHTML(`\`\`\`highlight-gutters
code rust:
let mut phrase = String::from("hi");
let result = phrase.clone();
let shared = &phrase;
println!("{result}: {shared}");
let phrasebook = "not the phrase token";
let exclusive = &mut phrase;
consume(exclusive);
consume(exclusive); // rejected: already moved
marks:
phrase 0,7
result copy phrase 1,3
shared &phrase 2,3
exclusive &mut phrase 5,6 move
reject 7
\`\`\`
`);
		document.body.innerHTML = html;

		const gutter = document.querySelector<HTMLElement>(".highlight-gutters");
		expect(gutter).not.toBeNull();
		expect(gutter?.style.getPropertyValue("--gutter-lanes")).toBe("3");
		expect(gutter?.getAttribute("role")).toBe("group");
		expect(gutter?.getAttribute("aria-label")).toMatch(
			/phrase.*lines? 0.*7.*result.*cop(?:y|ies).*phrase.*lines? 1.*3.*shared.*reference.*phrase.*lines? 2.*3.*exclusive.*mutable.*phrase.*lines? 5.*6/i,
		);

		const code = gutter?.querySelector("code.hljs.language-rust");
		expect(code).not.toBeNull();
		expect(code?.querySelector(".hljs-keyword")?.textContent).toBe("let");

		const markedPhraseTokens = [
			...(code?.querySelectorAll('[data-gutter-token="phrase"]') ?? []),
		];
		expect(markedPhraseTokens).toHaveLength(5);
		expect(
			markedPhraseTokens.every((token) => token.textContent === "phrase"),
		).toBe(true);
		expect(code?.textContent).toContain("phrasebook");

		for (const [name, colorIndex] of [
			["phrase", "0"],
			["result", "1"],
			["shared", "2"],
			["exclusive", "3"],
		] as const) {
			const tokens = code?.querySelectorAll(
				`[data-gutter-token="${name}"][data-gutter-color="${colorIndex}"]`,
			);
			expect(tokens?.length).toBeGreaterThan(0);
		}

		const lane = (name: string) =>
			gutter?.querySelector<HTMLElement>(`[data-gutter-mark="${name}"]`);

		expect(lane("phrase")?.dataset).toMatchObject({
			gutterKind: "independent",
			gutterColor: "0",
			gutterPlacement: "separate",
			startLine: "0",
			endLine: "7",
		});
		expect(lane("result")?.dataset).toMatchObject({
			gutterKind: "copy",
			gutterSource: "phrase",
			gutterColor: "1",
			gutterLane: "2",
			gutterPlacement: "separate",
			startLine: "1",
			endLine: "3",
		});
		expect(
			lane("result")?.classList.contains("highlight-gutter-touching"),
		).toBe(false);
		expect(lane("shared")?.dataset).toMatchObject({
			gutterKind: "reference",
			gutterSource: "phrase",
			gutterColor: "2",
			gutterLane: "1",
			gutterPlacement: "touching",
			startLine: "2",
			endLine: "3",
		});
		expect(
			lane("shared")?.classList.contains("highlight-gutter-touching"),
		).toBe(true);
		expect(
			gutter
				?.querySelector('[data-gutter-mark="phrase"][data-line="2"]')
				?.classList.contains("highlight-gutter-connected-source"),
		).toBe(true);
		expect(lane("exclusive")?.dataset).toMatchObject({
			gutterKind: "mutable-reference",
			gutterSource: "phrase",
			gutterColor: "3",
			gutterLane: "1",
			gutterPlacement: "touching",
			startLine: "5",
			endLine: "6",
		});
		expect(
			lane("exclusive")?.classList.contains("highlight-gutter-touching"),
		).toBe(true);
		expect(
			lane("exclusive")?.classList.contains("highlight-gutter-exclusive"),
		).toBe(true);
		expect(
			gutter?.querySelectorAll(
				'[data-gutter-mark="phrase"][data-line].highlight-gutter-locked',
			),
		).toHaveLength(2);
		expect(
			gutter?.querySelector(
				'[data-gutter-mark="exclusive"][data-line="6"] .highlight-gutter-move-terminal',
			),
		).not.toBeNull();
		expect(
			gutter?.querySelector('[data-line="7"].highlight-gutter-rejected'),
		).not.toBeNull();

		expect(gutter?.querySelector(".highlight-gutter-labels")).toBeNull();
		const decorativeBands =
			gutter?.querySelectorAll("[data-gutter-band]") ?? [];
		expect(decorativeBands.length).toBeGreaterThan(0);
		expect(
			[...decorativeBands].every(
				(band) => band.getAttribute("aria-hidden") === "true",
			),
		).toBe(true);
	});
});
