import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paperDir = resolve(import.meta.dirname, "..");
const section = resolve(paperDir, "sections", "03_mathematical_formulation.md");
const priorArtSection = resolve(paperDir, "sections", "02_prior_art.md");
const bibliography = resolve(paperDir, "refs.bib");
const provenanceTableModule = resolve(paperDir, "figures", "scoring-rule-provenance-table.typ");
const diagramExamples = ["order-ledger.typ", "pairwise-casebook.typ", "rank-ballot.typ"].map((name) =>
	resolve(paperDir, "sections", "03_diagram_examples", "archival", name),
);
const template = resolve(paperDir, "templates", "manifold-preprint.typ");
const generatedTypst = resolve(paperDir, "build", "rrf-coverage-normalization.typ");
const outputPdf = resolve(paperDir, "build", "rrf-coverage-normalization.pdf");
const compiler = resolve(import.meta.dirname, "compile-rrf-coverage-normalization.ts");

function compact(value: string): string {
	return value.replaceAll(/\s+/g, "");
}

function withoutTypstBlockComments(value: string): string {
	return value.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

function normalizePandocTypstMath(value: string): string {
	return compact(value)
		.replaceAll(/\\(?=[()[\],;])/g, "")
		.replaceAll(/\.(?=\$)/g, "");
}

function blockBetween(markdown: string, heading: string, nextHeading?: string): string {
	const startMarker = `${heading}\n`;
	const start = markdown.indexOf(startMarker);
	expect(start).toBeGreaterThanOrEqual(0);
	if (nextHeading === undefined) return markdown.slice(start);

	const end = markdown.indexOf(`${nextHeading}\n`, start + startMarker.length);
	expect(end).toBeGreaterThan(start);
	return markdown.slice(start, end);
}

describe("RRF mathematical formulation", () => {
	it("uses named coverage multipliers with consistent provenance and discussion order", () => {
		// Arrange: read the authored policy descriptions and their downstream uses.
		const mathematical = readFileSync(section, "utf8");
		const simulation = readFileSync(resolve(paperDir, "sections", "04_simulation.md"), "utf8");
		const discussion = readFileSync(resolve(paperDir, "sections", "05_discussion_conclusion.md"), "utf8");
		const priorArt = readFileSync(priorArtSection, "utf8");
		const provenanceTable = readFileSync(provenanceTableModule, "utf8");
		const headings = [
			"### Coverage division",
			"### Fixed retriever weights",
			"### Logarithmic RRF",
			"### Saturating RRF",
			"### Boundary and coverage analysis",
		];

		// Act: partition each coverage policy at its stable section boundary.
		const coverageDivision = blockBetween(mathematical, headings[0], headings[1]);
		const logarithmic = blockBetween(mathematical, headings[2], headings[3]);
		const saturating = blockBetween(mathematical, headings[3], headings[4]);

		// Assert: the shared score form gives each policy a named outer multiplier.
		expect(compact(mathematical)).toContain(
			"S_C(d)=S_{\\mathrm{RRF}}(d)C(R_d)",
		);
		expect(compact(coverageDivision)).toContain("C_{\\mathrm{inv}}(R_d)=\\frac{1}{|R_d|}");
		expect(compact(logarithmic)).toContain(
			"C_{\\mathrm{log}}(R_d;b,B)=B\\ln(|R_d|+b)",
		);
		expect(compact(saturating)).toContain(
			"C_{\\mathrm{sat}}(R_d;a,b,t)=\\operatorname{Sat}(|R_d|;a,b,t)",
		);

		for (const block of [coverageDivision, logarithmic, saturating]) {
			const intention = block.search(/(?:simplest|retains|can deemphasize)/i);
			const definition = block.search(/C_\{\\mathrm\{(?:inv|log|sat)\}\}/);
			const constraints = block.search(/(?:returned documents with \$\|R_d\|\\geq1|b\\geq0|admissible parameters)/i);
			const incrementalCoverage = block.search(/(?:current mean|increment from coverage|increment.*coverage)/i);
			expect(intention).toBeGreaterThanOrEqual(0);
			expect(definition).toBeGreaterThan(intention);
			expect(constraints).toBeGreaterThan(definition);
			expect(incrementalCoverage).toBeGreaterThan(constraints);
		}

		expect(coverageDivision).toMatch(/exceeds the current mean.*raises.*below.*lowers.*equal.*unchanged/is);
		expect(logarithmic).toMatch(/C_\{\\mathrm\{log\}\}.*positive.*diminish/is);
		expect(saturating).toMatch(/C_\{\\mathrm\{sat\}\}.*positive.*diminish/is);
		for (const downstream of [simulation, discussion]) {
			expect(downstream).toContain("C_{\\mathrm{log}}");
			expect(downstream).toContain("C_{\\mathrm{sat}}");
		}
		expect(priorArt).toMatch(/coverage division[\s\S]*?@fox1994/i);
		expect(provenanceTable).toMatch(/coverage division[\s\S]*?@fox1994/i);
	});

	it("aligns Prior Art with the logarithmic RRF family and native mathematical typography", () => {
		// Arrange: isolate the cited method discussions and the hidden comparison commentary.
		const priorArt = readFileSync(priorArtSection, "utf8");
		const compactPriorArt = compact(priorArt);
		const rrf = blockBetween(
			priorArt,
			"### Reciprocal-rank fusion and fixed weights",
			"### Rank-Biased Centroid",
		);
		const coverageNormalization = blockBetween(
			priorArt,
			"### Coverage normalization",
			"### Reciprocal-rank fusion and fixed weights",
		);
		const rbc = blockBetween(priorArt, "### Rank-Biased Centroid", "### ISR, logISR, and logN ISR");
		const isr = blockBetween(priorArt, "### ISR, logISR, and logN ISR");
		const commentary = priorArt.match(
			/<!--\s*### Within-paper commentary: closest analogues and search boundary[\s\S]*?-->/,
		)?.[0] ?? "";

		// Act: identify only code spans whose contents are mathematical notation.
		const mathematicalCodeSpans = [...priorArt.matchAll(/`([^`\n]+)`/g)]
			.map((match) => match[1])
			.filter((value) =>
				/^(?:R_d|d|n\(d\)|r|phi|sigma|i)$|(?:=|sum_|\^|\/[({]|\|R_d\|)/.test(value),
			);
		const formulaSemantics = [
			"S_{\\mathrm{RRF}}(d)=\\sum_{i\\inR_d}\\frac{1}{k+r_i(d)}",
			"S_{\\mathrm{ISR}}(d)=|R_d|\\sum_{i\\inR_d}\\frac{1}{r_i(d)^2}",
			"S_{\\mathrm{logISR}}(d)=\\ln(|R_d|)\\sum_{i\\inR_d}\\frac{1}{r_i(d)^2}",
			"S_{\\mathrm{logNISR}}(d;\\sigma)=\\ln(|R_d|+\\sigma)\\sum_{i\\inR_d}\\frac{1}{r_i(d)^2}",
			"S_{\\mathrm{log}}(d;b,B)=BS_{\\mathrm{RRF}}(d)\\ln(|R_d|+b)",
			"S_1(d)=S_{\\mathrm{RRF}}(d)\\frac{\\ln(|R_d|+1)}{\\ln2}",
		];

		// Assert: terminology, equations, and provenance agree with Mathematical Formulation.
		for (const formula of formulaSemantics) expect(compactPriorArt).toContain(formula);
		expect(priorArt).not.toContain("$$");
		expect(commentary).not.toBe("");
		expect(commentary).toContain("logarithmic RRF family");
		expect(compact(commentary)).toContain(
			"S_{\\mathrm{log}}(d;b,B)=BS_{\\mathrm{RRF}}(d)\\ln(|R_d|+b)",
		);
		expect(compact(commentary)).toContain(
			"S_1(d)=S_{\\mathrm{RRF}}(d)\\frac{\\ln(|R_d|+1)}{\\ln2}",
		);
		expect(priorArt).not.toMatch(/\\log(?:\b|_)/);
		expect(mathematicalCodeSpans).toEqual([]);
		expect(priorArt).not.toMatch(/\bthis paper\b/i);
		expect(commentary).not.toMatch(/\bcandidate\b|two[- ]branch|base[- ]log|separate additive[- ]shift/i);
		expect(commentary).not.toMatch(/RRF\(d\)\s*(?:\\?log|\\?ln)\(n\(d\)\+b\)/);
		expect(rrf).toContain("@cormack2009");
		expect(compact(coverageNormalization)).toContain(
			"S_{\\mathrm{technique}}(d)=S_{\\mathrm{RRF}}(d)C_{\\mathrm{technique}}(R_d)",
		);
		expect(compact(coverageNormalization)).toContain(
			"C_{\\mathrm{inv}}(R_d)=\\frac{1}{|R_d|}",
		);
		expect(coverageNormalization).toContain("@fox1994");
		expect(coverageNormalization).toMatch(/notation.*introduced here.*not.*attributed/is);
		expect(rbc).toContain("@bailey2017");
		expect(isr).toContain("@mourao2014");
		expect(commentary).toContain("@robertson2009");
		expect(commentary).toContain("@fox1994");
		for (const citation of [
			"@cormack2009",
			"@bailey2017",
			"@mourao2014",
			"@robertson2009",
			"@fox1994",
		]) {
			expect(priorArt).toContain(citation);
		}
		expect(compactPriorArt).toContain("$R_d$");
		expect(compactPriorArt).toContain("$|R_d|$");
	});

	it("teaches one logarithmic RRF family, its calibration, and its coverage-shape parameter", () => {
		// Arrange: read the authored source once and partition it by stable method headings.
		const markdown = readFileSync(section, "utf8");
		const activeMarkdown = withoutTypstBlockComments(markdown);
		const references = readFileSync(bibliography, "utf8");
		const provenanceTable = readFileSync(provenanceTableModule, "utf8");
		const compactSource = compact(markdown);
		const headings = [
			"### Plain RRF",
			"### Coverage division",
			"### Fixed retriever weights",
			"### Rank-Biased Centroid",
			"### ISR, logISR, and logN ISR",
			"### Logarithmic RRF",
			"### Saturating RRF",
			"### Boundary and coverage analysis",
		];
		const blocks = new Map(
			headings.map((heading, index) => [
				heading,
				blockBetween(markdown, heading, headings[index + 1]),
			]),
		);

		// Act and assert: notation is explicit, typed, and uses ln consistently.
		expect(markdown).not.toMatch(/Throughout,? .*log denotes (?:the )?natural logarithm/i);
		// Natural logarithms use ln throughout the unified family.
		expect(markdown).not.toMatch(/\\log(?:\b|_)/);
		expect(markdown).not.toMatch(/Evidence tier/i);
		expect(markdown).not.toMatch(/\bthis paper\b/i);
		expect(markdown).not.toMatch(/`S_(?:RRF|avg|w|RBC|log)/);
		expect(markdown).not.toMatch(/### (?:Additive shifted-log|Base-log) branch/);
		expect(markdown).not.toMatch(/S_\{\\mathrm\{(?:shift|base)\}\}/);
		expect(compactSource).toContain("I=\\{1,\\ldots,m\\}");
		expect(compactSource).toContain("m\\in\\mathbb{N}_{+}");
		expect(compactSource).toContain("I\\subset\\mathbb{Z}");
		expect(markdown).toMatch(/\$d\$ is a document/i);
		expect(compactSource).toContain("I_d&=\\{i\\inI:i\\text{ranks}d\\}");
		expect(compactSource).toContain("|R_d|&=|I_d|\\in\\{0,\\ldots,m\\}");
		expect(compactSource).toContain("\\subset\\mathbb{Z}_{\\geq0}");
		expect(compactSource).toContain("|R_d|\\in\\{1,\\ldots,m\\}\\subset\\mathbb{N}_{+}");
		expect(markdown).toMatch(/\$\|R_d\|=0\$.*boundary extension/is);
		expect(compactSource).toContain("r_i(d)\\in\\mathbb{N}_{+}");
		expect(compactSource).toContain("k\\in\\mathbb{R}_{>0}");
		expect(compactSource).toContain("w_i\\in\\mathbb{R}_{\\geq0}");
		expect(compactSource).toContain("\\phi\\in[0,1)\\subset\\mathbb{R}");
		expect(compactSource).toContain("\\sigma\\in[0,1]\\subset\\mathbb{R}");
		expect(compactSource).toContain("b\\in\\mathbb{R}_{\\geq0}");
		expect(compactSource).toContain("B\\in\\mathbb{R}_{>0}");
		expect(markdown).toMatch(/all nine scores.*real-valued.*nonnegative/is);
		expect(markdown).toMatch(/indices.*integers.*ranks.*positive natural.*parameters.*real/is);
		for (const score of ["RRF", "avg", "RBC", "ISR", "logISR", "logNISR", "log", "sat"])
			expect(compactSource).toContain(`S_{\\mathrm{${score}}}`);
		expect(compactSource).toContain("S_w");
		expect(markdown).toContain('scoring-rule-provenance-table.typ": scoring-rule-provenance-table');
		expect(markdown).toContain("#scoring-rule-provenance-table() <tbl:scoring-rule-provenance>");
		expect(markdown).not.toContain("Table: Provenance and boundary behavior");
		expect(provenanceTable.match(/caption:\s*\[Provenance and boundary behavior/g)).toHaveLength(1);
		expect(provenanceTable.match(/math\.equation\(\s*block:\s*true/g)).toHaveLength(1);
		expect(provenanceTable.match(/formula-cell\(\$/g)).toHaveLength(7);
		expect(provenanceTable).not.toContain("#linebreak()");
		for (const method of ["RRF", "coverage division", "S_w", "ISR", "logISR", "S_1", "sat"])
			expect(provenanceTable).toContain(method);
		for (const citation of ["cormack2009", "fox1994", "azureVectorWeighting", "mourao2014"])
			expect(provenanceTable).toContain(`@${citation}`);
		expect(compact(provenanceTable)).toContain(
			"ln(|R_d|)sum_(iinI_d)frac(1,r_i(d)^2)",
		);

		const definitions = [
			{
				heading: "### Plain RRF",
				formula:
					/S_\{\\mathrm\{RRF\}\}\(d\)\s*=\s*\\sum_\{i \\in I_d\}\s*\\frac\{1\}\{k \+ r_i\(d\)\}/,
				citations: ["@cormack2009"],
			},
			{
				heading: "### Coverage division",
				formula:
					/S_\{\\mathrm\{avg\}\}\(d\)\s*=\s*S_\{\\mathrm\{RRF\}\}\(d\)C_\{\\mathrm\{inv\}\}\(R_d\)/,
				citations: ["@cormack2009"],
			},
			{
				heading: "### Fixed retriever weights",
				formula:
					/S_w\(d\)\s*=\s*\\sum_\{i \\in I_d\}\s*\\frac\{w_i\}\{k \+ r_i\(d\)\}/,
				citations: ["@azureVectorWeighting"],
			},
			{
				heading: "### Rank-Biased Centroid",
				formula:
					/S_\{\\mathrm\{RBC\}\}\(d; \\phi\)\s*=\s*\\sum_\{i \\in I_d\} q_\\phi\(r_i\(d\)\)/,
				citations: ["@bailey2017"],
			},
			{
				heading: "### ISR, logISR, and logN ISR",
				formula:
					/S_\{\\mathrm\{ISR\}\}\(d\)\s*&=\s*\|R_d\|Q_\{\\mathrm\{ISR\}\}\(d\)[\s\S]*S_\{\\mathrm\{logISR\}\}\(d\)\s*&=\s*\\ln\(\|R_d\|\)Q_\{\\mathrm\{ISR\}\}\(d\)[\s\S]*S_\{\\mathrm\{logNISR\}\}\(d;\\sigma\)\s*&=\s*\\ln\(\|R_d\|\+\\sigma\)Q_\{\\mathrm\{ISR\}\}\(d\)/,
				citations: ["@mourao2014"],
			},
			{
				heading: "### Logarithmic RRF",
				formula:
					/S_\{\\mathrm\{log\}\}\(d; b, B\)\s*=\s*S_\{\\mathrm\{RRF\}\}\(d\)C_\{\\mathrm\{log\}\}\(R_d;b,B\)/,
				citations: ["@cormack2009", "@mourao2014"],
			},
		];

		for (const definition of definitions) {
			const block = blocks.get(definition.heading) ?? "";
			expect(block).toMatch(definition.formula);
			expect(block).toMatch(/\b(?:score|scores|scoring)\b/i);
			for (const citation of definition.citations) {
				expect(block).toContain(citation);
				expect(references).toContain(`{${citation.slice(1)},`);
			}
		}

		const plain = blocks.get("### Plain RRF") ?? "";
		expect(plain).toMatch(/better rank.*increases/is);
		expect(plain).toMatch(/increasing \$k\$.*lowers.*compresses/is);
		expect(plain).toMatch(/extra supporting retriever.*positive term/is);
		expect(plain).toMatch(/rank-damping constant.*not.*coverage normalizer/is);

		const average = blocks.get("### Coverage division") ?? "";
		expect(average).toMatch(/exceeds the current mean.*raises/is);
		expect(average).toMatch(/below.*lowers/is);
		expect(average).toMatch(/equal.*unchanged/is);
		expect(average).toMatch(/equal ranks.*invariant.*\$n/is);
		expect(average).toMatch(/removes.*automatic reward for agreement/is);
		expect(average).toMatch(/repeated retriever outputs.*not\s+accumulate/is);
		expect(average).not.toMatch(/\b(evidence|corroborat)\b/i);

		const weighted = blocks.get("### Fixed retriever weights") ?? "";
		expect(weighted).toMatch(/linear.*\$w_i\$/is);
		expect(weighted).toMatch(/\$w_i=0\$.*removes/is);
		expect(weighted).toMatch(/Multiplying every weight by one positive\s+constant/is);
		expect(weighted).toMatch(/rescales every document equally and preserves their ordering/is);
		expect(weighted).toMatch(/changing weights relative.*change.*order/is);
		expect(weighted).toMatch(/not.*coverage normalization/is);
		expect(weighted).toMatch(/Azure.*positive.*weights/is);
		expect(weighted).toMatch(/\$w_i=0\$.*mathematical endpoint.*not a claim.*Azure/is);

		const rbc = blocks.get("### Rank-Biased Centroid") ?? "";
		expect(rbc).toContain("\\begin{cases}");
		expect(compact(rbc)).toContain("(1-\\phi)\\phi^{r-1},&0<\\phi<1");
		expect(rbc).toMatch(/no interpretation of \$0\^0\$ is\s+required/is);
		expect(rbc).toMatch(/one-rank descent.*multiplies.*\$\\phi\$/is);
		expect(rbc).toMatch(/\$\\phi=0\$.*only rank one/is);
		expect(rbc).toMatch(/larger \$\\phi\$.*slower.*reduces.*rank-one mass/is);
		expect(compact(rbc)).toContain("\\phi=\\frac{r-1}{r}");
		expect(rbc).toMatch(/not globally monotone/is);
		expect(rbc).toMatch(/additional supporting retriever.*nonnegative mass/is);

		const isr = blocks.get("### ISR, logISR, and logN ISR") ?? "";
		expect(compact(isr)).toContain("Q_{\\mathrm{ISR}}(d)=\\sum_{i\\inI_d}\\frac{1}{r_i(d)^2}");
		expect(isr).toMatch(/inverse square.*head-heavy.*rank 1 to 2.*four/is);
		expect(isr).toMatch(/equal-rank support grows as \$n\^2\/r\^2\$/is);
		expect(compact(isr)).toContain("logISRreplacesthelinearouterfactorwith$\\lnn$");
		expect(compact(isr)).toContain("$\\ln1=0$removesallrank-dependentdistinctionwhen$n=1$");
		expect(isr).not.toMatch(/\b(evidence|corroborat)\b/i);
		expect(isr).toMatch(/\$\\sigma=0\$.*logISR.*\$\\sigma>0\$.*one retriever.*positive multiplier/is);
		expect(isr).toMatch(/\$\\sigma=1\$.*compressed.*low.*high coverage/is);
		expect(isr).toMatch(/logarithmic RRF family.*RRF-kernel analogue.*logN ISR/is);

		const logarithmic = blocks.get("### Logarithmic RRF") ?? "";
		const compactLogarithmic = compact(logarithmic);
		expect(compactLogarithmic).toContain(
			"S_{\\mathrm{log}}(d;b,B)=S_{\\mathrm{RRF}}(d)C_{\\mathrm{log}}(R_d;b,B)",
		);
		expect(compactLogarithmic).toContain("B>0");
		expect(compactLogarithmic).toContain("b\\geq0");
		expect(compactLogarithmic).toContain("|R_d|\\geq1");
		expect(logarithmic).toMatch(/global scale.*preserves.*order/is);
		expect(logarithmic).toMatch(/threshold.*combined.*signals.*calibration/is);
		expect(logarithmic).toMatch(/\$b\$.*one-retriever.*coverage levels.*marginal/is);
		expect.soft(compactLogarithmic).toContain(
			"C_{\\mathrm{log}}(n+1;b,B)-C_{\\mathrm{log}}(n;b,B)=B\\ln\\left(\\frac{n+1+b}{n+b}\\right)",
		);
		expect.soft(logarithmic).not.toContain("\\!");
		expect(logarithmic).toMatch(/increasing and concave.*diminishing increments/is);
		expect(compactLogarithmic).toContain("B=\\frac{1}{\\ln(1+b)}");
		expect(logarithmic).toMatch(/one-retriever multiplier.*one.*additional coverage reward/is);
		expect(compactLogarithmic).toContain("B=\\frac{1}{\\ln2}");
		expect(compactLogarithmic).toContain(
			"S_1(d)=S_{\\mathrm{RRF}}(d)\\frac{\\ln(|R_d|+1)}{\\ln2}",
		);
		expect(logarithmic).toMatch(/simple default.*one-retriever.*RRF/is);
		const generalDefinition = logarithmic.indexOf("S_{\\mathrm{log}}");
		const scaleDiscussion = logarithmic.indexOf("global scale");
		const shapeDiscussion = logarithmic.search(/\$b\$.*one-retriever.*coverage levels.*marginal/is);
		const normalizedSubfamily = logarithmic.indexOf("B=\\frac{1}{\\ln(1+b)}");
		const defaultSpecialization = logarithmic.indexOf("S_1(d)");
		expect(generalDefinition).toBeGreaterThanOrEqual(0);
		expect(scaleDiscussion).toBeGreaterThan(generalDefinition);
		expect(shapeDiscussion).toBeGreaterThan(scaleDiscussion);
		expect(normalizedSubfamily).toBeGreaterThan(shapeDiscussion);
		expect(defaultSpecialization).toBeGreaterThan(normalizedSubfamily);

		const analysis = blocks.get("### Boundary and coverage analysis") ?? "";
		const compactAnalysis = compact(analysis);
		expect(compactAnalysis).toContain("b\\geq0");
		expect(compactAnalysis).toContain("|R_d|\\geq1");
		expect(analysis).toMatch(/\$b=0\$.*one-retriever multiplier.*zero/is);
		expect(analysis).toMatch(/\$\|R_d\|=0\$.*undefined/is);
		expect(analysis).toMatch(/zero-coverage\s+extension.*\$b>0\$/is);
		expect(compactAnalysis).toContain("$0<b<1$gives$\\ln(b)<0$");
		expect(compactAnalysis).toContain("$b=1$gives$\\ln(b)=0$");
		expect(compactAnalysis).toContain("$b>1$gives$\\ln(b)>0$");
		expect(compactAnalysis).toContain("\\ln(1+b)\\to0");
		expect(compactAnalysis).toContain("b=1");
		expect(compactAnalysis).toContain("\\ln2");
		expect(analysis).toContain("uniformly over the fixed finite coverage range");
		expect(compactAnalysis).toContain(
			"\\frac{S_{\\mathrm{log}}(d;b,B)}{B\\lnb}=S_{\\mathrm{RRF}}(d)\\frac{\\ln(|R_d|+b)}{\\lnb}\\longrightarrowS_{\\mathrm{RRF}}(d)",
		);
		expect(analysis).toMatch(/strict, non-tied plain-RRF comparison/is);
		expect(analysis).toMatch(/tied by plain RRF.*differentiated.*finite \$b\$/is);
		expect(compactAnalysis).toContain("PlainRRFthengrowsas$n/(k+r)$");
		expect(compactAnalysis).toContain("coveragedivisionremains$1/(k+r)$");
		expect(compactAnalysis).toContain("ISRgrowsas$n^2/r^2$");
		expect(compactAnalysis).toContain("logISRas$n\\lnn/r^2$");
		expect(compactAnalysis).toContain("logNISRas$n\\ln(n+\\sigma)/r^2$");
		expect(compactAnalysis).toContain("Bn\\ln(n+b)");
		expect(analysis).toMatch(/unbounded.*growing-retriever family/is);
		expect(analysis).toMatch(/fixed finite \$I\$.*bounded/is);

		expect(activeMarkdown).toContain("rank-profile-comparison.typ");
		expect(activeMarkdown).toContain("rank-profile-comparison-grid.typ");
		expect(activeMarkdown).toContain("rank-profile-comparison-figure()");
		expect(activeMarkdown).toContain("rank-profile-comparison-grid-figure()");
		expect(activeMarkdown.match(/#figure\(/g)).toHaveLength(3);
		expect(activeMarkdown).toContain("counter(figure.where(kind: image)).update(0)");
		expect(activeMarkdown).not.toContain("parameter-sensitivity.svg");
		for (const diagram of diagramExamples)
			expect(readFileSync(diagram, "utf8")).toContain("#let ranking-figure");
		const templateSource = readFileSync(template, "utf8");
		const imageRule = templateSource.match(/show figure\.where\(kind: image\): it => \{[\s\S]*?\n  \}/)?.[0] ?? "";
		expect(imageRule).not.toBe("");
		expect(imageRule).not.toContain("float: true");
		const pageBoundary = activeMarkdown.indexOf("#pagebreak()");
		const figureAnchor = activeMarkdown.indexOf("rank-profile-comparison-figure()");
		expect(pageBoundary).toBeGreaterThan(markdown.lastIndexOf("\\ln(|R_d|+b)"));
		expect(figureAnchor).toBeGreaterThan(pageBoundary);
		expect(activeMarkdown.slice(pageBoundary, figureAnchor)).toContain("#set page(columns: 1)");
		expect(activeMarkdown.indexOf("#set page(columns: 2)", figureAnchor)).toBeGreaterThan(figureAnchor);

		rmSync(outputPdf, { force: true });
		const compiledPaper = spawnSync(process.execPath, [compiler], {
			cwd: resolve(paperDir, "..", ".."),
		});
		expect(compiledPaper.status).toBe(0);
		expect(existsSync(outputPdf)).toBe(true);
		expect(statSync(outputPdf).size).toBeGreaterThan(0);

		const rendered = readFileSync(generatedTypst, "utf8");
		const priorArtStart = rendered.indexOf("= Introduction & Prior Art");
		const mathematicalStart = rendered.indexOf("= Mathematical Formulation");
		expect(priorArtStart).toBeGreaterThanOrEqual(0);
		expect(mathematicalStart).toBeGreaterThanOrEqual(0);
		const renderedPriorArt = rendered.slice(priorArtStart, mathematicalStart);
		const normalizedPriorArtMath = normalizePandocTypstMath(renderedPriorArt);
		expect(rendered).toContain('set text(font: "Libertinus Serif"');
		expect(rendered).toContain('show raw: set text(font: "JetBrains Mono"');
		expect(renderedPriorArt).not.toContain("`");
		for (const formula of [
			"$S_(upright(RRF))(d)=sum_(iinR_d)frac(1,k+r_i(d))$",
			"$S_(upright(ISR))(d)=\\|R_d\\|sum_(iinR_d)frac(1,r_i(d)^2)$",
			"$S_(upright(logISR))(d)=ln(\\|R_d\\|)sum_(iinR_d)frac(1,r_i(d)^2)$",
			"$S_(upright(logNISR))(d;sigma)=ln(\\|R_d\\|+sigma)sum_(iinR_d)frac(1,r_i(d)^2)$",
			"$S_(upright(log))(d;b,B)=BS_(upright(RRF))(d)ln(\\|R_d\\|+b)$",
			"$S_1(d)=S_(upright(RRF))(d)frac(ln(\\|R_d\\|+1),ln2)$",
		])
			expect(normalizedPriorArtMath).toContain(formula);
		expect(renderedPriorArt).not.toMatch(/\n\n\$ [^\n]+ \$\n\n/);
		for (const citation of ["cormack2009", "bailey2017", "mourao2014", "robertson2009", "fox1994"])
			expect(renderedPriorArt).toContain(`@${citation}`);
		const renderedMathematics = rendered.slice(mathematicalStart);
		const activeRenderedMathematics = withoutTypstBlockComments(renderedMathematics);
		const compactTypst = compact(renderedMathematics);
		expect(renderedMathematics).not.toMatch(/Evidence tier/i);
		expect(renderedMathematics).not.toMatch(/\bthis paper\b/i);
		// Generated prose may contain method names and "logarithm"; math uses ln only.
		expect(compactTypst).not.toMatch(/\blog(?:_|\\\()/);
		expect(compactTypst).toContain("S_(upright(RRF))");
		expect(compactTypst).toContain("S_(upright(avg))");
		expect(compactTypst).toContain("S_w");
		expect(compactTypst).toContain("S_(upright(RBC))");
		expect(compactTypst).toContain("S_(upright(ISR))");
		expect(compactTypst).toContain("S_(upright(logISR))");
		expect(compactTypst).toContain("S_(upright(logNISR))");
		expect(compactTypst).toContain("S_(upright(log))");
		expect(compactTypst).not.toContain("S_(upright(shift))");
		expect(compactTypst).not.toContain("S_(upright(base))");
		expect.soft(renderedMathematics).not.toContain("#h(-1em)");
		expect.soft(compactTypst).toContain("Bln(frac(n+1+b,n+b))");
		expect(activeRenderedMathematics).toContain("rank-profile-comparison.typ");
		expect(activeRenderedMathematics).toContain("rank-profile-comparison-grid.typ");
		expect(activeRenderedMathematics).not.toContain("parameter-sensitivity.svg");
		expect(rendered.match(/scoring-rule-provenance-table\(\)/g)).toHaveLength(1);
		expect(renderedMathematics).toContain("scoring-rule-provenance-table.typ");
		expect(activeRenderedMathematics.indexOf("pagebreak()"))
			.toBeLessThan(activeRenderedMathematics.indexOf("rank-profile-comparison-figure()"));
		for (const definition of definitions) {
			for (const citation of definition.citations) expect(renderedMathematics).toContain(citation);
		}
	});
});
