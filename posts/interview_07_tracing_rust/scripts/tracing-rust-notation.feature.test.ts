import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";

const postDir = resolve(import.meta.dirname, "..");
const post = resolve(postDir, "post.md");
const candidates = resolve(postDir, "candidates");

const baseline = resolve(candidates, "00-baseline.md");
const tTable = resolve(candidates, "01-t-table.md");
const lifeline = resolve(candidates, "02-lifeline.md");
const hybrid = resolve(candidates, "03-hybrid.md");
const comparison = resolve(candidates, "comparison.md");

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
	it("stages the T-table into Rust ownership across three drawable candidates", () => {
		// Arrange: the post and its five candidate documents.
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

		// Assert: the post is a real, unlisted post that hands off to the prior one.
		expect(front.data.title).toBeTruthy();
		expect(front.data.summary).toBeTruthy();
		expect(front.data.show).toBe(false);
		expect(body).toContain("/blog/interview_03_tracing");
		expect(body).toMatch(/\bnot been tested\b|\buntested\b/i);

		// Only post.md is emitted as a route; links to source-only candidate files would be broken.
		expect(body).not.toMatch(/\/blog\/interview_07_tracing_rust\/candidates\//);
		for (const heading of [
			"Stage 0",
			"Candidate A",
			"Candidate B",
			"Candidate C",
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
			// Worked traces are ASCII, so they are diffable and reviewable in text.
			expect(text, `${name} needs worked traces`).toMatch(/```text[\s\S]*?```/);
			// One ink color: no mark may depend on color alone.
			expect(text).toMatch(/one (?:ink )?color|single color|survives.*one ink/i);
		}

		const candidateA = candidateTexts.get("extended T-table")!;
		expect(candidateA).toMatch(/\| Borrow ends \| The `\*` or `#` is crossed out/);
		expect(candidateA).toMatch(/\| Binding end \/ drop \| `†`/);
		expect(candidateA).toMatch(/reference binding's scope/i);

		const candidateB = candidateTexts.get("lifeline graph")!;
		expect(candidateB).toMatch(/\| Loan ends \|[^\n]*`-C-` or `-<-`/);
		expect(candidateB).toMatch(/\| Binding end \/ drop \|[^\n]*`<>`/);
		expect(candidateB).toMatch(/continue the reference's\s+dotted binding lifeline/i);
		expect(candidateB).toMatch(/share a decision rule, not one geometric tell/i);
		expect(candidateB).not.toMatch(/error tell is uniform/i);

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
		expect(candidateBSection).toContain("<>");
		expect(candidateBSection).not.toContain("<#>");
		expect(candidateBSection).toMatch(/Borrow brackets close[\s\S]*binding's diamond/);

		const candidateCSection = body.slice(body.indexOf("## Candidate C"));
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

		// Assert: the comparison picks a winner on the draw-order criterion and
		// says what a test with people would measure.
		expect(comparisonText).toMatch(/^#+ Recommendation/im);
		expect(comparisonText).toMatch(/hybrid/i);
		expect(comparisonText).toMatch(/add detail rather than change/i);
		expect(comparisonText).toMatch(/incremental|draw order/i);
		expect(comparisonText).toMatch(/\bnot been tested\b|\buntested\b/i);
		expect(comparisonText).toMatch(/^#+ (?:What to test|Test protocol)/im);
		for (const name of ["extended T-table", "lifeline", "hybrid"]) {
			expect(comparisonText).toMatch(new RegExp(name, "i"));
		}
	});
});
