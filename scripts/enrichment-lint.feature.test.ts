import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintEnrichment } from "./enrichment-lint.ts";

// This test lives in scripts/, so the repo root is one directory up.
const ROOT = join(import.meta.dirname, "..");

describe("enrichment authoring guardrail lint", () => {
	it("the committed hvar enrichment.yaml yields zero findings", () => {
		// Arrange: the real, committed worked-example file is the positive control.
		const raw = readFileSync(
			join(ROOT, "trips", "hvar", "enrichment.yaml"),
			"utf-8",
		);

		// Act
		const findings = lintEnrichment("hvar", raw);

		// Assert
		expect(findings).toEqual([]);
	});

	it("a 6-char PNR-style locator in free text does NOT trip secret-pattern", () => {
		// Arrange: 6-char booking locators (e.g. GHBT2Y) sit at the repo's existing
		// sensitivity bar and must pass — the passport rule starts at 9 chars.
		const raw = `trip_prep:
  notes:
    - "Re-confirm booking GHBT2Y at check-in."
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.filter((f) => f.rule === "secret-pattern")).toEqual([]);
	});

	it("a rule-bearing checklist item missing a url fires link-required", () => {
		// Arrange: an item that asserts a rule (has detail, not no_action) but
		// carries no authoritative gov source.
		const raw = `trip_prep:
  checklist:
    - label: "UK ETA — apply for each traveler"
      status: action_needed
      detail: "Multi-entry, valid 2 years."
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.map((f) => f.rule)).toContain("link-required");
		expect(findings.some((f) => f.rule === "secret-pattern")).toBe(false);
	});

	it("a fake 9-char passport-style number fires secret-pattern", () => {
		// Arrange: an ID-like token (letters + digits, 9 chars) under a passport
		// document entry. Mimics a raw passport number leaking into the registry.
		const raw = `meta:
  travelers:
    - name: "David Souther"
      documents:
        - { type: passport, status: in_progress, note: "number AB1234567 on file" }
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.map((f) => f.rule)).toContain("secret-pattern");
	});

	it("a passport number under an explicit number key fires secret-pattern", () => {
		// Arrange: a short reference (would slip past the 9-char free-text rule)
		// placed under a key that names a document number.
		const raw = `meta:
  travelers:
    - name: "Anne Levine"
      passport_number: "12345678"
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.map((f) => f.rule)).toContain("secret-pattern");
	});

	it("a full-day valid_until (YYYY-MM-DD) fires secret-pattern", () => {
		// Arrange: valid_until is coarse YYYY-MM by rule; an exact day is too precise.
		const raw = `meta:
  travelers:
    - name: "David Souther"
      documents:
        - { type: passport, status: in_progress, valid_until: "2026-10-22" }
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.map((f) => f.rule)).toContain("secret-pattern");
	});

	it("an exact DOB under a birth key fires secret-pattern", () => {
		// Arrange: an exact date of birth must never be committed.
		const raw = `meta:
  travelers:
    - name: "David Souther"
      date_of_birth: "1985-03-14"
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.map((f) => f.rule)).toContain("secret-pattern");
	});

	it("a coarse YYYY-MM valid_until does NOT fire secret-pattern", () => {
		// Arrange: the allowed month-granular form is the negative control for the
		// full-day valid_until rule.
		const raw = `meta:
  travelers:
    - name: "David Souther"
      documents:
        - { type: passport, status: in_progress, valid_until: "2026-10" }
`;

		// Act
		const findings = lintEnrichment("fixture", raw);

		// Assert
		expect(findings.filter((f) => f.rule === "secret-pattern")).toEqual([]);
	});
});
