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

/** The seven programs every candidate must be drawn against. */
const LISTINGS = ["2.2", "2.5", "2.9", "2.11", "2.12", "2.13"];

/** The marks every candidate must define. */
const SEMANTICS = [
	/\bmove\b/i,
	/\bcopy\b/i,
	/\bmutable borrow\b/i,
	/\bborrow\b/i,
	/\bdrop\b/i,
	/\blifetime\b/i,
];

/** The three canonical errors the material must make visible. */
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

		// Assert: the corrected four-verb table reads with three answers, not two,
		// carries an Access column, and gives Mutable Borrow its own row.
		const table = body.slice(body.indexOf("| Move"));
		expect(body).toMatch(/\|\s*Access\s*\|/);
		expect(body).toMatch(/the same as \/ new from \/ a reference to/i);
		for (const verb of ["Move", "Copy", "Borrow", "Mutable borrow"]) {
			expect(table).toMatch(new RegExp(`^\\|\\s*${verb}\\s*\\|`, "im"));
		}
		// Owner of the data is unchanged by either borrow; the prose wins over the sketch.
		const borrowRows = table
			.split("\n")
			.filter((row) => /^\|\s*(?:Mutable b|B)orrow\s*\|/i.test(row));
		expect(borrowRows).toHaveLength(2);
		for (const row of borrowRows) expect(row).toMatch(/Same\s*—?\s*`?var_a`?/i);
		// The binding's own stack slot is not a column: every `let` makes a new one.
		expect(body).toMatch(/every `?let`? (?:makes|creates) a new slot/i);

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
