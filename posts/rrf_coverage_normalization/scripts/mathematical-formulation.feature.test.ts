import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { equalSupportScores } from "./generate-parameter-sensitivity-figure.ts";

const paperDir = resolve(import.meta.dirname, "..");
const section = resolve(paperDir, "sections", "03_mathematical_formulation.md");
const bibliography = resolve(paperDir, "refs.bib");
const figure = resolve(paperDir, "figures", "parameter-sensitivity.svg");
const figureGenerator = resolve(import.meta.dirname, "generate-parameter-sensitivity-figure.ts");
const template = resolve(paperDir, "templates", "manifold-preprint.typ");
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
	it("teaches one logarithmic RRF family, its calibration, and its coverage-shape parameter", () => {
		// Arrange: read the authored source once and partition it by stable method headings.
		const markdown = readFileSync(section, "utf8");
		const references = readFileSync(bibliography, "utf8");
		const compactSource = compact(markdown);
		const headings = [
			"### Plain RRF",
			"### Coverage division",
			"### Fixed retriever weights",
			"### Rank-Biased Centroid",
			"### ISR, logISR, and logN ISR",
			"### Logarithmic RRF family",
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
		expect(compactSource).toContain("I_d=\\{i\\inI:i\\text{ranks}d\\}");
		expect(compactSource).toContain("n(d)=|I_d|\\in\\{0,\\ldots,m\\}");
		expect(compactSource).toContain("\\subset\\mathbb{Z}_{\\geq0}");
		expect(compactSource).toContain("n(d)\\in\\{1,\\ldots,m\\}\\subset\\mathbb{N}_{+}");
		expect(markdown).toMatch(/\$n\(d\)=0\$.*boundary extension/is);
		expect(compactSource).toContain("r_i(d)\\in\\mathbb{N}_{+}");
		expect(compactSource).toContain("k\\in\\mathbb{R}_{>0}");
		expect(compactSource).toContain("w_i\\in\\mathbb{R}_{\\geq0}");
		expect(compactSource).toContain("\\phi\\in[0,1)\\subset\\mathbb{R}");
		expect(compactSource).toContain("\\sigma\\in[0,1]\\subset\\mathbb{R}");
		expect(compactSource).toContain("b\\in\\mathbb{R}_{\\geq0}");
		expect(compactSource).toContain("B\\in\\mathbb{R}_{>0}");
		expect(markdown).toMatch(/all eight scores.*real-valued.*nonnegative/is);
		expect(markdown).toMatch(/indices.*integers.*ranks.*positive natural.*parameters.*real/is);
		for (const score of ["RRF", "avg", "RBC", "ISR", "logISR", "logNISR", "log"])
			expect(compactSource).toContain(`S_{\\mathrm{${score}}}`);
		expect(compactSource).toContain("S_w");

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
				heading: "### ISR, logISR, and logN ISR",
				formula:
					/S_\{\\mathrm\{ISR\}\}\(d\)\s*&=\s*n\(d\)Q_\{\\mathrm\{ISR\}\}\(d\)[\s\S]*S_\{\\mathrm\{logISR\}\}\(d\)\s*&=\s*\\ln\(n\(d\)\)Q_\{\\mathrm\{ISR\}\}\(d\)[\s\S]*S_\{\\mathrm\{logNISR\}\}\(d;\\sigma\)\s*&=\s*\\ln\(n\(d\)\+\\sigma\)Q_\{\\mathrm\{ISR\}\}\(d\)/,
				citations: ["@mourao2014"],
			},
			{
				heading: "### Logarithmic RRF family",
				formula:
					/S_\{\\mathrm\{log\}\}\(d; b, B\)\s*=\s*B S_\{\\mathrm\{RRF\}\}\(d\)\\ln\(n\(d\) \+ b\)/,
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
		expect(weighted).toMatch(/\$w_i=0\$.*removes/is);
		expect(weighted).toMatch(/Multiplying every weight by one positive\s+constant/is);
		expect(weighted).toMatch(/rescales every document equally and preserves their ordering/is);
		expect(weighted).toMatch(/changing weights relative.*change.*order/is);
		expect(weighted).toMatch(/not.*realized-coverage normalization/is);
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
		expect(compact(isr)).toContain("$\\ln1=0$erasesallrankevidencewhen$n=1$");
		expect(isr).toMatch(/\$\\sigma=0\$.*logISR.*\$\\sigma>0\$.*singleton.*positive multiplier/is);
		expect(isr).toMatch(/\$\\sigma=1\$.*compressed.*low.*high coverage/is);
		expect(isr).toMatch(/logarithmic RRF family.*RRF-kernel analogue.*logN ISR/is);

		const logarithmic = blocks.get("### Logarithmic RRF family") ?? "";
		const compactLogarithmic = compact(logarithmic);
		expect(compactLogarithmic).toContain(
			"S_{\\mathrm{log}}(d;b,B)=BS_{\\mathrm{RRF}}(d)\\ln(n(d)+b)",
		);
		expect(compactLogarithmic).toContain("B>0");
		expect(compactLogarithmic).toContain("b\\geq0");
		expect(compactLogarithmic).toContain("n(d)\\geq1");
		expect(logarithmic).toMatch(/global scale.*preserves.*order/is);
		expect(logarithmic).toMatch(/threshold.*combined.*signals.*calibration/is);
		expect(logarithmic).toMatch(/\$b\$.*singleton.*coverage levels.*marginal/is);
		expect(logarithmic).toMatch(/increasing and concave.*diminishing increments/is);
		expect(compactLogarithmic).toContain("B=\\frac{1}{\\ln(1+b)}");
		expect(logarithmic).toMatch(/singleton multiplier.*one.*additional coverage reward/is);
		expect(compactLogarithmic).toContain("B=\\frac{1}{\\ln2}");
		expect(compactLogarithmic).toContain(
			"S_1(d)=S_{\\mathrm{RRF}}(d)\\frac{\\ln(n(d)+1)}{\\ln2}",
		);
		expect(logarithmic).toMatch(/simple default.*singleton.*RRF/is);
		const generalDefinition = logarithmic.indexOf("S_{\\mathrm{log}}");
		const scaleDiscussion = logarithmic.indexOf("global scale");
		const shapeDiscussion = logarithmic.search(/\$b\$.*singleton.*coverage levels.*marginal/is);
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
		expect(compactAnalysis).toContain("n(d)\\geq1");
		expect(analysis).toMatch(/\$b=0\$.*singleton multiplier.*zero/is);
		expect(analysis).toMatch(/\$n\(d\)=0\$.*undefined/is);
		expect(analysis).toMatch(/zero-coverage\s+extension.*\$b>0\$/is);
		expect(compactAnalysis).toContain("$0<b<1$gives$\\ln(b)<0$");
		expect(compactAnalysis).toContain("$b=1$gives$\\ln(b)=0$");
		expect(compactAnalysis).toContain("$b>1$gives$\\ln(b)>0$");
		expect(compactAnalysis).toContain("\\ln(1+b)\\to0");
		expect(compactAnalysis).toContain("b=1");
		expect(compactAnalysis).toContain("\\ln2");
		expect(analysis).toContain("uniformly over the fixed finite coverage range");
		expect(compactAnalysis).toContain(
			"\\frac{S_{\\mathrm{log}}(d;b,B)}{B\\lnb}=S_{\\mathrm{RRF}}(d)\\frac{\\ln(n(d)+b)}{\\lnb}\\longrightarrowS_{\\mathrm{RRF}}(d)",
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

		expect(markdown).toMatch(/!\[[^\]]*parameter sensitivity[^\]]*\]\([^)]*parameter-sensitivity\.svg\)/i);
		expect(markdown).toMatch(/common\s+maximum\s+normalizes every curve within each panel.*analytic/is);
		expect(markdown).toMatch(/eight scoring rules.*\$b\$ curves use\s+\$B=1\/\\ln\(1\+b\)\$/is);
		expect(markdown).toMatch(/default \$b=1\$, \$B=1\/\\ln2\$.*same singleton RRF score/is);

		const singletonDefault = equalSupportScores(1, {
			k: 20,
			rank: 5,
			weight: 1,
			phi: 0.5,
			sigma: 0.01,
			b: 1,
			B: 1 / Math.log(2),
		});
		expect(singletonDefault.S_log).toBeCloseTo(singletonDefault.S_RRF);
		const doubledScale = equalSupportScores(4, {
			k: 20,
			rank: 5,
			weight: 1,
			phi: 0.5,
			sigma: 0.01,
			b: 1,
			B: 2 / Math.log(2),
		});
		expect(doubledScale.S_log).toBeCloseTo(
			2 * equalSupportScores(4, {
				k: 20,
				rank: 5,
				weight: 1,
				phi: 0.5,
				sigma: 0.01,
				b: 1,
				B: 1 / Math.log(2),
			}).S_log,
		);

		const generatedFigure = spawnSync(process.execPath, [figureGenerator], {
			cwd: resolve(paperDir, "..", ".."),
		});
		expect(generatedFigure.status).toBe(0);
		expect(existsSync(figure)).toBe(true);
		expect(statSync(figure).size).toBeGreaterThan(0);
		const svg = readFileSync(figure, "utf8");
		const regeneratedFigure = spawnSync(process.execPath, [figureGenerator], {
			cwd: resolve(paperDir, "..", ".."),
		});
		expect(regeneratedFigure.status).toBe(0);
		expect(readFileSync(figure, "utf8")).toBe(svg);
		for (const score of ["S_RRF", "S_avg", "S_w", "S_RBC", "S_ISR", "S_logISR", "S_logNISR", "S_log"])
			expect(svg).toContain(`data-score="${score}"`);
		for (const parameter of ["r", "n / support", "k", "w_i", "φ", "σ", "b", "B"])
			expect(svg).toContain(`data-parameter="${parameter}"`);
		expect(svg).not.toMatch(/S_(?:shift|base)|base-log|two-branch|b_s|b_ℓ/i);
		expect(svg).toContain('data-normalization-policy="one-common-maximum-per-panel"');
		expect(svg).toContain('data-coverage-perturbation="append-identical-rank-5-supporter"');
		expect(svg).toContain('data-n-semantics="add-one-supporting-retriever"');
		expect(svg.match(/data-normalization="panel-common-max"/g)).toHaveLength(7);
		expect(svg).toMatch(/data-score="S_w" data-parameter="n \/ support"[^>]*>●<\/text>/);
		expect(svg).toMatch(/data-score="S_avg" data-parameter="n \/ support"[^>]*>◐<\/text>/);
		expect(svg).toContain("an arbitrary added rank makes only the average effect directional");
		expect(svg).toContain("ISR-family growth");
		expect(svg).toContain("append an identical rank-5 supporter");
		expect(svg).toContain("global scale only; order unchanged");
		expect(svg).toContain("Shape b (all B=1/ln(1+b))");
		expect(svg).toContain("S_log b=1 (default)");
		expect(svg).toMatch(/data-score="S_log" data-parameter="b"[^>]*>●<\/text>/);
		expect(svg).toMatch(/data-score="S_log" data-parameter="B"[^>]*>○<\/text>/);
		const templateSource = readFileSync(template, "utf8");
		const imageRule = templateSource.match(/show figure\.where\(kind: image\): it => \{[\s\S]*?\n  \}/)?.[0] ?? "";
		expect(imageRule).not.toBe("");
		expect(imageRule).not.toContain("float: true");
		const pageBoundary = markdown.indexOf("#pagebreak()");
		const figureAnchor = markdown.indexOf("![Parameter sensitivity");
		expect(pageBoundary).toBeGreaterThan(markdown.lastIndexOf("\\ln(n(d)+b)"));
		expect(figureAnchor).toBeGreaterThan(pageBoundary);
		expect(markdown.slice(pageBoundary, figureAnchor)).toContain("#set page(columns: 1)");
		expect(markdown.indexOf("#set page(columns: 2)")).toBeGreaterThan(figureAnchor);

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
		expect(renderedMathematics).toContain("parameter-sensitivity.svg");
		expect(renderedMathematics.indexOf("pagebreak()")).toBeLessThan(renderedMathematics.indexOf("parameter-sensitivity.svg"));
		for (const definition of definitions) {
			for (const citation of definition.citations) expect(renderedMathematics).toContain(citation);
		}
	});
});
