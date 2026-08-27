import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paperDir = resolve(import.meta.dirname, "..");
const section = resolve(paperDir, "sections", "03_mathematical_formulation.md");
const bibliography = resolve(paperDir, "refs.bib");
const figure = resolve(paperDir, "figures", "parameter-sensitivity.svg");
const figureGenerator = resolve(import.meta.dirname, "generate-parameter-sensitivity-figure.ts");
const generatedTypst = resolve(paperDir, "build", "rrf-coverage-normalization.typ");
const outputPdf = resolve(paperDir, "build", "rrf-coverage-normalization.pdf");
const compiler = resolve(import.meta.dirname, "compile-rrf-coverage-normalization.ts");

function compact(value: string): string {
	return value.replaceAll(/\s+/g, "");
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
	it("teaches six named scores, both logarithmic branches, and their parameter sensitivity", () => {
		// Arrange: read the authored source once and partition it by stable method headings.
		const markdown = readFileSync(section, "utf8");
		const references = readFileSync(bibliography, "utf8");
		const compactSource = compact(markdown);
		const headings = [
			"### Plain RRF",
			"### Coverage division",
			"### Fixed retriever weights",
			"### Rank-Biased Centroid",
			"### Additive shifted-log branch",
			"### Base-log branch",
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
		// Natural logarithms use ln; the only remaining log spelling is the explicit base-log operator.
		expect(markdown).not.toMatch(/\\log(?!_)/);
		expect(markdown).not.toMatch(/Evidence tier/i);
		expect(markdown).not.toMatch(/\bthis paper\b/i);
		expect(markdown).not.toMatch(/`S_(?:RRF|avg|w|RBC|shift|base)/);
		expect(compactSource).toContain("I=\\{1,\\ldots,m\\}");
		expect(compactSource).toContain("m\\in\\mathbb{N}_{+}");
		expect(compactSource).toContain("I\\subset\\mathbb{Z}");
		expect(markdown).toMatch(/\$d\$ is a document/i);
		expect(compactSource).toContain("I_d=\\{i\\inI:i\\text{ranks}d\\}");
		expect(compactSource).toContain("n(d)=|I_d|\\in\\{0,\\ldots,m\\}");
		expect(compactSource).toContain("\\subset\\mathbb{Z}_{\\geq0}");
		expect(compactSource).toContain("n(d)\\in\\{1,\\ldots,m\\}\\subset\\mathbb{N}_{+}");
		expect(markdown).toMatch(/\$n\(d\)=0\$.*boundary extension/is);
		expect(compactSource).toContain("r_i(d)\\in\\mathbb{N}_{+}");
		expect(compactSource).toContain("k\\in\\mathbb{R}_{>0}");
		expect(compactSource).toContain("w_i\\in\\mathbb{R}_{\\geq0}");
		expect(compactSource).toContain("\\phi\\in[0,1)\\subset\\mathbb{R}");
		expect(compactSource).toContain("b_s\\in\\mathbb{R}_{\\geq0}");
		expect(compactSource).toContain("b_\\ell\\in\\mathbb{R}_{>1}");
		expect(compactSource).toContain("B=\\frac{1}{\\ln(b_\\ell)}\\in\\mathbb{R}_{>0}");
		expect(markdown).toMatch(/each (?:named )?score.*real-valued.*nonnegative/is);

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
					/S_\{\\mathrm\{avg\}\}\(d\)\s*=\s*\\frac\{S_\{\\mathrm\{RRF\}\}\(d\)\}\{n\(d\)\}/,
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
				heading: "### Additive shifted-log branch",
				formula:
					/S_\{\\mathrm\{shift\}\}\(d; b_s\)\s*=\s*S_\{\\mathrm\{RRF\}\}\(d\)\\ln\(n\(d\) \+ b_s\)/,
				citations: ["@cormack2009", "@mourao2014"],
			},
			{
				heading: "### Base-log branch",
				formula:
					/S_\{\\mathrm\{base\}\}\(d; b_\\ell\)\s*=\s*S_\{\\mathrm\{RRF\}\}\(d\)\\log_\{b_\\ell\}\(n\(d\)\)/,
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
		expect(average).toMatch(/removes.*automatic reward for agreement.*discard.*consensus/is);

		const weighted = blocks.get("### Fixed retriever weights") ?? "";
		expect(weighted).toMatch(/linear.*\$w_i\$/is);
		expect(weighted).toMatch(/zero weight.*removes/is);
		expect(weighted).toMatch(/multiplying all weights.*positive constant.*without changing.*order/is);
		expect(weighted).toMatch(/relative weights.*change.*order/is);
		expect(weighted).toMatch(/not.*realized-coverage normalization/is);

		const rbc = blocks.get("### Rank-Biased Centroid") ?? "";
		expect(rbc).toContain("\\begin{cases}");
		expect(compact(rbc)).toContain("(1-\\phi)\\phi^{r-1},&0<\\phi<1");
		expect(rbc).toContain("no interpretation of $0^0$ is required");
		expect(rbc).toMatch(/one-rank descent.*multiplies.*\$\\phi\$/is);
		expect(rbc).toMatch(/\$\\phi=0\$.*only rank one/is);
		expect(rbc).toMatch(/larger \$\\phi\$.*slower.*reduces.*rank-one mass/is);
		expect(compact(rbc)).toContain("\\phi=\\frac{r-1}{r}");
		expect(rbc).toMatch(/not globally monotone/is);
		expect(rbc).toMatch(/additional supporting retrievers.*nonnegative mass/is);

		const shifted = blocks.get("### Additive shifted-log branch") ?? "";
		expect(shifted).toMatch(/fixed \$n(?:\(d\))?\$.*ranks.*\$k\$.*S_\{\\mathrm\{RRF\}\}/is);
		expect(shifted).toMatch(/fixed RRF score.*increasing coverage.*increases the multiplier/is);
		expect(shifted).toMatch(/marginal coverage increments diminish/is);
		expect(shifted).toMatch(/same \$n(?:\(d\))?\$.*preserves.*RRF order/is);
		expect(shifted).toMatch(/\$b_s=0\$.*\$n\(d\)=1\$.*zero tie/is);

		const base = blocks.get("### Base-log branch") ?? "";
		expect(compact(base)).toContain("S_{\\mathrm{base}}(d;b_\\ell)=BS_{\\mathrm{RRF}}(d)\\ln(n(d))");
		expect(base).toMatch(/\$n\(d\)>1\$.*rank.*\$k\$.*RRF/is);
		expect(base).toMatch(/singleton.*zero/is);
		expect(base).toMatch(/\$B>0\$.*rescale.*cannot change.*rank/is);
		expect(base).toMatch(/increasing.*\$b_\\ell\$.*decreases.*\$B/is);
		expect(base).toMatch(/singleton.*coverage policy.*additive shift/is);

		const analysis = blocks.get("### Boundary and coverage analysis") ?? "";
		const compactAnalysis = compact(analysis);
		expect(compactAnalysis).toContain("b_s\\geq0");
		expect(compactAnalysis).toContain("n(d)\\geq1");
		expect(analysis).toMatch(/\$b_s=0\$.*singleton multiplier.*zero/is);
		expect(analysis).toMatch(/\$n\(d\)=0\$.*undefined/is);
		expect(analysis).toMatch(/zero-coverage extension.*\$b_s>0\$/is);
		expect(compactAnalysis).toContain("B=\\frac{1}{\\ln(b_\\ell)}>0");
		expect(analysis).toMatch(/not.*extracting.*constant.*\\ln\(n\+b_s\)/is);
		expect(compactAnalysis).toContain("\\ln(n+b_s)\\neqB\\lnn");
		expect(analysis).toMatch(/reparameterization.*\\log_\{b_\\ell\}n/is);
		expect(compactAnalysis).toMatch(/0<b_s<1.*\\ln\(b_s\).*negative/);
		expect(compactAnalysis).toMatch(/b_s=1.*\\ln\(b_s\).*zero/);
		expect(compactAnalysis).toMatch(/b_s>1.*\\ln\(b_s\).*positive/);
		expect(compactAnalysis).toContain("\\ln(1+b_s)\\to0");
		expect(compactAnalysis).toContain("b_s=1");
		expect(compactAnalysis).toContain("\\ln2");
		expect(analysis).toContain("uniformly over the fixed finite coverage range");
		expect(compactAnalysis).toContain(
			"\\frac{S_{\\mathrm{shift}}(d;b_s)}{\\lnb_s}=S_{\\mathrm{RRF}}(d)\\frac{\\ln(n(d)+b_s)}{\\lnb_s}\\longrightarrowS_{\\mathrm{RRF}}(d)",
		);
		expect(analysis).toMatch(/strict, non-tied plain-RRF comparison/is);
		expect(analysis).toMatch(/tied by plain RRF.*differentiated.*finite \$b_s\$/is);
		expect(analysis).toMatch(/plain RRF.*proportion to \$n\$/is);
		expect(analysis).toMatch(/coverage division.*constant/is);
		expect(compactAnalysis).toContain("n\\ln(n+b_s)");
		expect(compactAnalysis).toContain("Bn\\lnn");
		expect(analysis).toMatch(/unbounded.*growing-retriever family/is);
		expect(analysis).toMatch(/fixed finite \$I\$.*bounded/is);

		expect(markdown).toMatch(/!\[[^\]]*parameter sensitivity[^\]]*\]\([^)]*parameter-sensitivity\.svg\)/i);
		expect(markdown).toMatch(/held constant.*normalized.*analytic discussion/is);

		const generatedFigure = spawnSync(process.execPath, [figureGenerator], {
			cwd: resolve(paperDir, "..", ".."),
		});
		expect(generatedFigure.status).toBe(0);
		expect(existsSync(figure)).toBe(true);
		expect(statSync(figure).size).toBeGreaterThan(0);
		const svg = readFileSync(figure, "utf8");
		for (const score of ["S_RRF", "S_avg", "S_w", "S_RBC", "S_shift", "S_base"])
			expect(svg).toContain(`data-score="${score}"`);
		for (const parameter of ["r", "n", "k", "w_i", "φ", "b_s", "b_ℓ / B"])
			expect(svg).toContain(`data-parameter="${parameter}"`);
		expect(svg).toContain("Equal-rank growth");
		expect(svg).toContain("global scale only; order unchanged");

		rmSync(outputPdf, { force: true });
		const compiledPaper = spawnSync(process.execPath, [compiler], {
			cwd: resolve(paperDir, "..", ".."),
		});
		expect(compiledPaper.status).toBe(0);
		expect(existsSync(outputPdf)).toBe(true);
		expect(statSync(outputPdf).size).toBeGreaterThan(0);

		const rendered = readFileSync(generatedTypst, "utf8");
		const mathematicalStart = rendered.indexOf("= Mathematical Formulation");
		expect(mathematicalStart).toBeGreaterThanOrEqual(0);
		const renderedMathematics = rendered.slice(mathematicalStart);
		const compactTypst = compact(renderedMathematics);
		expect(renderedMathematics).not.toMatch(/Evidence tier/i);
		expect(renderedMathematics).not.toMatch(/\bthis paper\b/i);
		// Generated prose may contain "logarithm"; only an unbased math log is forbidden.
		expect(compactTypst).not.toMatch(/\blog\\\(/);
		expect(compactTypst).toContain("S_(upright(RRF))");
		expect(compactTypst).toContain("S_(upright(avg))");
		expect(compactTypst).toContain("S_w");
		expect(compactTypst).toContain("S_(upright(RBC))");
		expect(compactTypst).toContain("S_(upright(shift))");
		expect(compactTypst).toContain("S_(upright(base))");
		expect(renderedMathematics).toContain("parameter-sensitivity.svg");
		for (const definition of definitions) {
			for (const citation of definition.citations) expect(renderedMathematics).toContain(citation);
		}
	});
});
