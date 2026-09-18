import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { toHTML } from "../../../src/lib/markdown.ts";

const postDir = resolve(import.meta.dirname, "..");
const post = resolve(postDir, "post.md");
const candidates = resolve(postDir, "candidates");

const baseline = resolve(candidates, "00-baseline.md");
const tTable = resolve(candidates, "01-t-table.md");
const lifeline = resolve(candidates, "02-lifeline.md");
const hybrid = resolve(candidates, "03-hybrid.md");
const gutterHighlights = resolve(candidates, "04-gutter-highlights.md");
const combined = resolve(candidates, "05-combined.md");
const comparison = resolve(candidates, "comparison.md");
const globalCss = resolve(postDir, "../../src/global.css");

const LISTINGS = ["2.2", "2.5", "2.9", "2.11", "2.12", "2.13"];

const SEMANTICS = [
	/\bmove\b/i,
	/\bcopy\b/i,
	/\bmutable borrow\b/i,
	/\bborrow\b/i,
	/\bdrop\b/i,
	/\blifetime\b/i,
];

const ERRORS = [
	/use after (?:a )?move/i,
	/outliv\w+ (?:its )?referent/i,
	/return\w* (?:a )?reference/i,
];

function read(path: string): string {
	return readFileSync(path, "utf8");
}

describe("Rust tracing notation teaching material", () => {
	it("marks and explains the rejected returned-local stack pointer", () => {
		const body = matter(read(post)).content;
		const returnedLocal = body.slice(
			body.indexOf("### Returning a stack pointer"),
			body.indexOf("Candidate CD remains"),
		);
		const returnedLocalFence = returnedLocal.match(
			/```highlight-gutters\n([\s\S]*?)```/,
		)?.[1];

		expect(returnedLocalFence).toBeDefined();
		expect(returnedLocalFence).toContain("my_art &art 2,11");
		expect(returnedLocalFence).toContain("show &my_art 5,6");
		expect(returnedLocalFence).toContain("reject 2");
		expect(returnedLocal).toMatch(/touching gutter bands/i);
		expect(returnedLocal).toMatch(
			/`ret` row[^.]*`&art`[^.]*points back[^.]*`art` row/i,
		);
		expect(returnedLocal).toMatch(
			/returning would leave\s+`my_art` pointing into a callee frame/i,
		);
	});

	it("stages the T-table into Rust ownership across five drawable candidates", () => {
		const postSource = read(post);
		const front = matter(postSource);
		const body = front.content;
		const baselineText = read(baseline);
		const candidateTexts = new Map([
			["extended T-table", read(tTable)],
			["lifeline graph", read(lifeline)],
			["hybrid", read(hybrid)],
		]);
		const comparisonText = read(comparison);
		const styles = read(globalCss);

		// Assert: the post is a real, unlisted post that hands off to the prior one.
		expect(front.data.title).toBeTruthy();
		expect(front.data.summary).toBeTruthy();
		expect(front.data.show).toBe(false);
		expect(body).toMatch(/\bnot been tested\b|\buntested\b/i);

		// Only post.md is emitted as a route; links to source-only candidate files would be broken.
		expect(body).not.toMatch(/\/blog\/interview_07_tracing_rust\/candidates\//);
		for (const heading of [
			"Candidate A",
			"Candidate B",
			"Candidate C",
			"Candidate D",
			"Candidate CD",
			"What to test",
		]) {
			expect(body).toMatch(new RegExp(`^## ${heading}`, "im"));
		}

		const table = body.slice(body.indexOf("| Move"));
		expect(body).toMatch(/\|\s*Access after the statement\s*\|/i);
		for (const verb of ["Move", "Copy", "Borrow", "Mutable borrow"]) {
			expect(table).toMatch(new RegExp(`^\\|\\s*${verb}\\s*\\|`, "im"));
		}
		expect(table).toMatch(/^\|\s*Borrow\s*\|\s*`let var_b = &var_a;`/im);
		expect(table).toMatch(
			/^\|\s*Mutable borrow\s*\|\s*`let var_b = &mut var_a;`/im,
		);
		// Borrow kind changes access, not ownership.
		const borrowRows = table
			.split("\n")
			.filter((row) => /^\|\s*(?:Mutable b|B)orrow\s*\|/i.test(row));
		expect(borrowRows).toHaveLength(2);
		for (const row of borrowRows) expect(row).toMatch(/Still `var_a`/i);
		expect(body).toMatch(/Rust specifies ownership and access, not whether/i);

		// Assert: Stage 0 recreates the existing repertoire with no new marks.
		for (const form of [
			/cross(?:ed)?[- ]out/i,
			/heap/i,
			/frame/i,
			/return arrow/i,
			/watch/i,
			/dashed/i,
		]) {
			expect(baselineText).toMatch(form);
		}
		expect(baselineText).toMatch(/no (?:new )?Rust[- ]specific marks|zero Rust marks/i);
		for (const stage0 of [body, baselineText]) {
			expect(stage0).toMatch(/phrase\s*\|\s*0x10\s*-+>/);
			expect(stage0).toMatch(/word\s*\|\s*0x10\s*-+>/);
			expect(stage0).not.toMatch(/(?:phrase|word)\s*\|\s*~~0x10~~/);
		}
		for (const mark of SEMANTICS.slice(0, 4)) {
			expect(baselineText).not.toMatch(new RegExp(`${mark.source} (?:mark|glyph)`, "i"));
		}

		// Assert: each candidate is drawn against every listing, defines every mark,
		// and proves it can be drawn one statement at a time without back-editing.
		for (const [name, text] of candidateTexts) {
			for (const listing of LISTINGS) {
				expect(text, `${name} must draw listing ${listing}`).toContain(
					`listing ${listing}`,
				);
			}
			expect(text, `${name} must add a Copy example`).toMatch(
				/\bCopy\b[\s\S]{0,400}?```rust/,
			);
			for (const mark of SEMANTICS) {
				expect(text, `${name} must define a ${mark.source} mark`).toMatch(mark);
			}
			for (const error of ERRORS) {
				expect(text, `${name} must show ${error.source}`).toMatch(error);
			}
			expect(text, `${name} needs a Draw order section`).toMatch(
				/^#+ Draw order/im,
			);
			expect(text, `${name} draw order must be statement by statement`).toMatch(
				/statement by statement|one statement at a time|line by line/i,
			);
			expect(text, `${name} must not require back-editing`).toMatch(
				/no back[- ]editing|without back[- ]editing|never (?:erased|moved|reserved)/i,
			);
			// Text source keeps every worked trace inspectable and diffable.
			if (name === "lifeline graph") {
				expect(text).toMatch(/```mermaid\s+flowchart TD/);
			} else {
				expect(text, `${name} needs worked traces`).toMatch(/```text[\s\S]*?```/);
			}
			// One ink color: no mark may depend on color alone.
			expect(text).toMatch(/one (?:ink )?color|single color|survives.*one ink/i);
		}

		const candidateA = candidateTexts.get("extended T-table")!;
		expect(candidateA).toMatch(/\| Borrow ends \| The `\*` or `#` is crossed out/);
		expect(candidateA).toMatch(/\| Binding end \/ drop \| `†`/);
		expect(candidateA).toMatch(/reference binding's scope/i);

		const candidateB = candidateTexts.get("lifeline graph")!;
		expect(candidateB).toMatch(/\| Loan ends \|[^\n]*`C` or `<`/);
		expect(candidateB).toMatch(/\| Binding end \/ drop \|[^\n]*diamond/i);
		expect(candidateB).toMatch(/Reference binding[^\n]*reference node/i);
		expect(candidateB).toMatch(/share a decision\s+rule, not one geometric tell/i);
		expect(candidateB).not.toMatch(/error tell is uniform/i);
		expect(candidateB.match(/```mermaid\s+flowchart TD/g)).toHaveLength(7);
		expect(candidateB).not.toMatch(/```text/);
		expect(candidateB).toMatch(/attempted[^\n]*-. rejected/);

		const candidateC = candidateTexts.get("hybrid")!;
		expect(candidateC).toMatch(
			/`\\\|` \| An owning binding still has a value; borrow brackets determine its current access/,
		);
		expect(candidateC).toMatch(/active loan runs from[^\n]*`C` or `<`/i);
		expect(candidateC).toMatch(/reference binding runs from `o` to `R`/i);
		expect(candidateC).not.toMatch(/bindings that end free their column for reuse/i);
		expect(candidateC).toContain("art1 art#1 art#2 || main");
		expect(candidateC).toMatch(/A label never changes\s+or names a later binding/i);
		expect(candidateC).toMatch(/does the current ruler state\s+permit this operation/i);
		expect(candidateC).not.toMatch(/three errors, as one mark|all three canonical errors are a gap/i);

		const candidateASection = body.slice(
			body.indexOf("## Candidate A"),
			body.indexOf("## Candidate B"),
		);
		expect(candidateASection).toContain("`∅@s2`");
		expect(candidateASection).toContain("crossed-out `*` / `#`");
		expect(candidateASection).toContain("`†@s4`");

		const candidateBSection = body.slice(
			body.indexOf("## Candidate B"),
			body.indexOf("## Candidate C"),
		);
		expect(candidateBSection.match(/```mermaid\s+flowchart TD/g)).toHaveLength(7);
		expect(candidateBSection).not.toMatch(/```text/);
		expect(candidateBSection).toMatch(
			/Borrow brackets close[\s\S]*binding's\s+(?:end node|diamond)/,
		);
		expect(candidateBSection).toMatch(
			/let ref1 = &art1;\s+admire_shared\(ref1\);\s+let ref2 = &art1;\s+admire_shared\(ref2\);/,
		);
		expect(candidateBSection).toMatch(/D: shared loan ref1 opens[\s\S]*C: loan ref2 closes/);
		for (const heading of [
			"A plain owned value",
			"A `Copy` value",
			"Move and use after move",
			"Shared and mutable borrows",
			"A move rejected while borrowed",
			"Returning a reference to a local",
		]) {
			expect(candidateBSection).toContain(`### ${heading}`);
		}

		const candidateCSection = body.slice(
			body.indexOf("## Candidate C"),
			body.indexOf("## Candidate D"),
		);
		for (const heading of [
			"A plain owned value",
			"A `Copy` value",
			"Move and use after move",
			"Shared and mutable borrows",
			"A move rejected while borrowed",
			"Returning a reference to a local",
		]) {
			expect(candidateCSection).toContain(`### ${heading}`);
		}
		for (const definition of [
			"struct Artwork",
			"fn admire_owned",
			"fn admire_shared",
			"fn record_view",
		]) {
			expect(candidateCSection).toContain(definition);
		}
		expect(candidateCSection).toContain("art1 ref1 ref2 ||");
		expect(candidateCSection).toContain("art1 mref1 mref2 ||");
		expect(candidateCSection).toMatch(
			/`C` and `<` close those loans; `R` separately\s+ends/,
		);

		const gutterText = read(gutterHighlights);
		const candidateDSection = body.slice(
			body.indexOf("## Candidate D"),
			body.indexOf("## Draw order and recommendation"),
		);
		for (const text of [gutterText]) {
			expect(text).toMatch(/left(?:-hand)? gutter/i);
			expect(text).toMatch(/literal\s+highlighter band/i);
			expect(text).toMatch(/lexical\s+binding scope/i);
			expect(text).toMatch(/active\s+loan/i);
			expect(text).toMatch(/conservative lexical subset/i);
			expect(text).toMatch(/overstates?\s+(?:the\s+)?(?:real\s+)?active loan/i);
			expect(text).toMatch(/non-lexical lifetimes|NLL/i);
			expect(text).toMatch(/shared loans? (?:may|can) overlap/i);
			expect(text).toMatch(/overlap (?:alone|by itself) is not (?:an )?error/i);
			expect(text).toMatch(/incompatible access/i);
			expect(text).toMatch(/rejected operation[^.]*does not execute/i);
			expect(text).toMatch(/different\s+highlighter color/i);
			expect(text).toContain('class="lifetime-gutter"');
			expect(text).toContain('class="lifetime-band"');
			expect(text).toMatch(/source[^.]*`&`[^.]*`&mut`|`&`[^.]*`&mut`[^.]*source/i);
			expect(text).not.toContain('role="img"');
			for (const container of text.match(/<div class="lifetime-gutter"[^>]*>/g) ?? []) {
				expect(container).toContain('role="group"');
				expect(container).toContain("aria-label=");
			}
			for (const band of text.match(/<span class="lifetime-band[^>]*>/g) ?? []) {
				expect(band).toContain('aria-hidden="true"');
			}
			expect(text).not.toContain("<span></span>");
		}
		for (const listing of LISTINGS) {
			expect(gutterText, `gutter highlights must draw listing ${listing}`).toContain(
				`listing ${listing}`,
			);
		}
		for (const heading of [
			"A plain owned value",
			"A `Copy` value",
			"Move and use after move",
			"Shared and mutable borrows",
			"A move rejected while borrowed",
			"Returning a reference to a local",
		]) {
			expect(candidateDSection).toContain(`### ${heading}`);
		}
		expect(gutterText).toMatch(/borrow[^.]*closing brace/i);
		expect(gutterText).toMatch(/inner blocks?[\s\S]*mutable borrow/i);
		for (const text of [gutterText]) {
			expect(text).toMatch(/shared[\s\S]*requested (?:`|&amp;)?&?mut/i);
			expect(text).toMatch(/proof obligation/i);
			expect(text).toMatch(
				/let shared = &amp;art1;[\s\S]*let requested_mut = &amp;mut art1; \/\/ rejected:[\s\S]*shared\.name/,
			);
			expect(text).toMatch(/not an executed loan|no second loan executes/i);
		}
		expect(gutterText).not.toMatch(/band ends? at (?:its |the )?last use/i);
		for (const text of [gutterText]) {
			expect(text).toMatch(
				/lifetime-end[\s\S]*?&amp;art \/\/ rejected return[\s\S]*?<code>}<\/code>[\s\S]*?lifetime-end[\s\S]*?caller would still require the reference here/,
			);
			expect(text).not.toMatch(/lifetime-end[^>]*><\/span><code>}<\/code>/);
		}

		const combinedText = read(combined);
		const candidateCDSection = body.slice(
			body.indexOf("## Candidate CD"),
			body.indexOf("## Draw order and recommendation"),
		);
		for (const text of [combinedText]) {
			expect(text).toMatch(/lexical[^.]*teaching simplification/i);
			expect(text).toContain('class="lifetime-composite"');
			expect(text).toContain('class="lifetime-gutter lifetime-gutter-geometry"');
			expect(text).not.toContain('class="lifetime-symbol"');
			expect(text).toMatch(/<pre class="mermaid"[^>]*>traceDiagram/);
			expect(text).toMatch(/different\s+highlighter color/i);
			expect(text).toMatch(/return(?:ing)? a (?:stack pointer|reference to a stack-local)/i);
			expect(text).toMatch(/use after (?:free|move)/i);
			expect(text).toMatch(/Rust rejects[^.]*before[^.]*runtime state/i);
			expect(text).toMatch(/aria-label="[^"]+"/);
			expect(text).toMatch(/touch(?:ing|es)[^.]*sideways pyramid/i);
			expect(text).not.toContain("lifetime-connector");
			expect(text).not.toContain("data-label=");
			expect(text).toContain('class="lifetime-move-terminal"');
			expect(text).toContain('class="lifetime-band lifetime-suspended"');
		}
		for (const heading of [
			"A plain owned value",
			"A `Copy` value",
			"Move and use after move",
			"Shared borrows",
			"Mutable borrows",
			"A move rejected while borrowed",
			"Returning a stack pointer",
		]) {
			expect(combinedText).toContain(`## ${heading}`);
			expect(candidateCDSection).toContain(`### ${heading}`);
		}
		for (const text of [combinedText]) {
			expect(text.match(/class="lifetime-composite"/g)).toHaveLength(7);
			expect(text.match(/>traceDiagram/g)).toHaveLength(7);
			expect(
				text.match(
					/class="lifetime-gutter lifetime-gutter-geometry lifetime-gutter-connected"/g,
				),
			).toHaveLength(4);
			const connectedGutters =
				text.match(
					/<div class="lifetime-gutter lifetime-gutter-geometry lifetime-gutter-connected"[\s\S]*?<pre>/g,
				) ?? [];
			expect(connectedGutters).toHaveLength(4);
			for (const gutter of connectedGutters) {
				expect(gutter).not.toContain('class="lifetime-labels"');
			}
			expect(text.match(/class="lifetime-labels"/g)).toHaveLength(3);

			expect(text.match(/class="lifetime-band lifetime-suspended"/g)).toHaveLength(4);

			const copyExample = text.slice(
				text.indexOf("A `Copy` value"),
				text.indexOf("Move and use after move"),
			);
			expect(copyExample).not.toContain("lifetime-gutter-connected");

			const moveExample = text.slice(
				text.indexOf("Move and use after move"),
				text.indexOf("Shared borrows"),
			);
			expect(moveExample).toContain('style="--lanes: 1"');
			expect(moveExample).not.toContain("lifetime-gutter-connected");
			expect(moveExample).not.toMatch(/callee art|lifetime-gutter-connected/);
			expect(moveExample).toMatch(
				/lifetime-band lifetime-end[^>]*><\/span><span class="lifetime-move-terminal" aria-hidden="true"><\/span><code>    admire_owned\(art1\);<\/code>/,
			);

			const useAfterMoveDiagram = text.slice(
				text.indexOf("title Ownership check for use after move"),
				text.indexOf("</pre>", text.indexOf("title Ownership check for use after move")),
			);
			const acceptedFirstCall = useAfterMoveDiagram.indexOf(
				"\n    watch first admire_owned: accepted, moves art1",
			);
			const executedCall = useAfterMoveDiagram.indexOf("frame admire_owned");
			const rejectedRetry = useAfterMoveDiagram.indexOf(
				"watch second admire_owned: rejected",
			);
			expect(acceptedFirstCall).toBeGreaterThan(-1);
			expect(executedCall).toBeGreaterThan(-1);
			expect(rejectedRetry).toBeGreaterThan(-1);
			expect(acceptedFirstCall).toBeLessThan(executedCall);
			expect(executedCall).toBeLessThan(rejectedRetry);

			const returnedLocal = text.slice(
				text.indexOf("Returning a stack pointer"),
				text.indexOf("Candidate CD", text.indexOf("Returning a stack pointer")),
			);
			expect(returnedLocal).toContain(
				'<span class="lifetime-line"><span aria-hidden="true"></span><span class="lifetime-band" aria-hidden="true"></span><code>}</code></span>',
			);
			expect(returnedLocal).toMatch(/blue[^.]*extends beyond[^.]*yellow owner/i);
		}
		expect(combinedText).toMatch(/yellow `art` band[^.]*`&art` line/i);
		expect(styles).toMatch(/nth-child\(1\)[\s\S]*#f4d35e/);
		expect(styles).toMatch(/nth-child\(2\)[\s\S]*#56b4e9/);
		expect(styles).toContain("Use distinct lane colors only as a secondary cue");
		expect(styles).toContain(
			".lifetime-line > .lifetime-band.lifetime-suspended",
		);
		expect(styles).toMatch(
			/\.lifetime-gutter-connected \.lifetime-line[\s\S]*--lifetime-lane-width:\s*1\.35rem/,
		);
		expect(styles).toMatch(
			/\.lifetime-gutter-connected[\s\S]*column-gap:\s*0/,
		);
		expect(styles).toMatch(
			/\.lifetime-gutter-connected \.lifetime-band[\s\S]*width:\s*100%/,
		);
		expect(styles).toMatch(/\.lifetime-band\s*\{[\s\S]*?width:\s*1\.35rem/);
		expect(styles).not.toMatch(
			/\.lifetime-gutter-connected \.lifetime-labels/,
		);
		expect(styles).toMatch(
			/\.lifetime-move-terminal\s*\{[\s\S]*?border-block-start:/,
		);
		expect(styles).not.toMatch(/\.lifetime-(?:connector|borrow-return)/);
		expect(styles).toMatch(
			/\.lifetime-composite[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
		);

		expect(comparisonText).toMatch(/^#+ Recommendation/im);
		expect(comparisonText).toMatch(/hybrid/i);
		expect(comparisonText).toMatch(/add detail rather than change/i);
		expect(comparisonText).toMatch(/incremental|draw order/i);
		expect(comparisonText).toMatch(/\bnot been tested\b|\buntested\b/i);
		expect(comparisonText).toMatch(/^#+ (?:What to test|Test protocol)/im);
		for (const name of [
			"extended T-table",
			"Mermaid node graph",
			"hybrid",
			"gutter highlighter",
			"Candidate CD",
		]) {
			expect(comparisonText).toMatch(new RegExp(name, "i"));
		}
	});

	it("generates all Candidate D and CD gutters from semantic fences", () => {
		const body = matter(read(post)).content;
		const candidateCDSection = body.slice(
			body.indexOf("## Candidate CD"),
			body.indexOf("## Draw order and recommendation"),
		);

		expect(body.match(/```highlight-gutters/g)).toHaveLength(15);
		expect(body).not.toContain('<div class="lifetime-gutter');
		expect(body).not.toContain('<div class="lifetime-composite');
		expect(candidateCDSection.match(/```highlight-gutters/g)).toHaveLength(7);
		expect(candidateCDSection.match(/```mermaid\s+traceDiagram/g)).toHaveLength(7);

		const rendered = toHTML(body);
		const renderedCD = toHTML(candidateCDSection);
		expect(rendered.match(/class="highlight-gutters"/g)).toHaveLength(15);
		expect(
			rendered.match(/<figure class="trace-figure lifetime-composite">/g),
		).toHaveLength(7);
		expect(
			renderedCD.match(/<figure class="trace-figure lifetime-composite">/g),
		).toHaveLength(7);
		const renderedD = rendered.slice(
			rendered.indexOf("Candidate D:"),
			rendered.indexOf("Candidate CD:"),
		);
		expect(renderedD).not.toContain("lifetime-composite");
		expect(rendered).toContain('data-gutter-kind="copy"');
		expect(rendered).toContain('data-gutter-kind="reference"');
		expect(rendered).toContain('data-gutter-kind="mutable-reference"');
		expect(rendered).toContain("highlight-gutter-locked");
		expect(rendered).toContain("highlight-gutter-move-terminal");
		expect(rendered).toContain("highlight-gutter-rejected");
		expect(rendered).toContain('role="group"');
		expect(rendered).toContain('aria-hidden="true"');
	});
});
