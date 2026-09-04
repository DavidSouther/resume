import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
	illustrativeHomeEnergyFixture,
	type FixtureDocument,
	type RankerName,
	type RankingFixture,
} from "../evals/illustrative-home-energy.ts";

type ScoreId = "S_RRF" | "S_w" | "S_ISR" | "S_1" | "S_sat";
export type SaturationParameters = Readonly<{ a: number; b: number; t: number }>;
type RankMap = Readonly<Record<RankerName, Readonly<Record<string, number | null>>>>;
type SimulationResult = Readonly<{ id: string; coverage: number; scores: Readonly<Record<ScoreId, number>> }>;
type Method = Readonly<{
	id: ScoreId;
	formula: string;
	nonzeroAtN1: boolean;
	boundedBonus: boolean;
	source: string;
}>;

export type SimulationReport = Readonly<{
	fixture: Readonly<{
		label: string;
		query: string;
		rankers: readonly RankerName[];
		weights: Readonly<Record<RankerName, number>>;
		k: number;
		documents: readonly (FixtureDocument & { ranks: Readonly<Record<RankerName, number | null>> })[];
	}>;
	rankMaps: RankMap;
	methods: readonly Method[];
	results: readonly SimulationResult[];
	orders: Readonly<Record<ScoreId, readonly string[]>>;
	comparisons: Readonly<{ rankerReversal: string; methodDisagreement: string }>;
}>;

const scoreIds: readonly ScoreId[] = ["S_RRF", "S_w", "S_ISR", "S_1", "S_sat"];
const workedSaturation: SaturationParameters = { a: 3, b: 0.1, t: 2 };

export function saturationMultiplier(coverage: number, parameters: SaturationParameters): number {
	return 1 + parameters.a * (1 - Math.exp((1 + parameters.b - coverage) / parameters.t));
}

export function saturatedRrf(rrfScore: number, coverage: number, parameters: SaturationParameters): number {
	return rrfScore * saturationMultiplier(coverage, parameters);
}

function methodsFor(fixture: RankingFixture): readonly Method[] {
	return [
		{ id: "S_RRF", formula: `\\sum_{i \\in I_d} 1 / (${fixture.k} + r_i(d))`, nonzeroAtN1: true, boundedBonus: false, source: "RRF [@cormack2009]" },
		{ id: "S_w", formula: `\\sum_{i \\in I_d} w_i / (${fixture.k} + r_i(d))`, nonzeroAtN1: true, boundedBonus: false, source: "Azure weighted vector queries [@azureVectorWeighting]" },
		{ id: "S_ISR", formula: "|R_d|\\sum_{i \\in I_d} 1 / r_i(d)^2", nonzeroAtN1: true, boundedBonus: false, source: "ISR [@mourao2014]" },
		{ id: "S_1", formula: "S_{\\mathrm{RRF}}\\ln(|R_d| + 1) / \\ln(2)", nonzeroAtN1: true, boundedBonus: false, source: "Singleton-normalized specialization used here" },
		{ id: "S_sat", formula: "S_{\\mathrm{RRF}}(1 + a(1 - \\exp((1 + b - |R_d|) / t)))", nonzeroAtN1: true, boundedBonus: true, source: "Derived here" },
	];
}

/** Rejects malformed fixture input before the scoring service can consume it. */
export function validateFixture(fixture: RankingFixture): void {
	if (fixture.rankers.length === 0) throw new Error("fixture must define at least one ranker");
	if (!Number.isFinite(fixture.k) || fixture.k <= 0) throw new Error("fixture k must be a positive number");
	const documentIds = new Set<string>();
	for (const document of fixture.documents) {
		if (!document.id) throw new Error("fixture document IDs must be nonempty");
		if (documentIds.has(document.id)) throw new Error(`duplicate fixture document ID: ${document.id}`);
		documentIds.add(document.id);
	}
	for (const ranker of fixture.rankers) {
		if (!(ranker in fixture.rankings)) throw new Error(`missing ranking for ${ranker}`);
		if (!(ranker in fixture.weights)) throw new Error(`missing weight for ${ranker}`);
		const weight = fixture.weights[ranker];
		if (!Number.isFinite(weight) || weight < 0) throw new Error(`invalid weight for ${ranker}`);
		const seen = new Set<string>();
		for (const documentId of fixture.rankings[ranker]) {
			if (!documentIds.has(documentId)) throw new Error(`unknown document ${documentId} in ${ranker}`);
			if (seen.has(documentId)) throw new Error(`duplicate document ${documentId} in ${ranker}`);
			seen.add(documentId);
		}
	}
	for (const ranker of Object.keys(fixture.weights)) if (!fixture.rankers.includes(ranker as RankerName)) throw new Error(`unknown weight ranker: ${ranker}`);
}

function deriveRankMaps(fixture: RankingFixture): RankMap {
	return Object.fromEntries(fixture.rankers.map((ranker) => [ranker, Object.fromEntries(fixture.documents.map((document) => [document.id, fixture.rankings[ranker].indexOf(document.id) + 1 || null]))])) as RankMap;
}

/** Calculates every score from one fixture, retaining unrounded values for ordering. */
export function calculateSimulation(fixture: RankingFixture): SimulationReport {
	validateFixture(fixture);
	const rankMaps = deriveRankMaps(fixture);
	const documents = fixture.documents.map((document) => ({ ...document, ranks: Object.fromEntries(fixture.rankers.map((ranker) => [ranker, rankMaps[ranker][document.id]])) as Record<RankerName, number | null> }));
	const results: SimulationResult[] = documents.map((document) => {
		const ranks = fixture.rankers.flatMap((ranker) => document.ranks[ranker] === null ? [] : [{ ranker, rank: document.ranks[ranker] }]);
		const coverage = ranks.length;
		const rrf = ranks.reduce((sum, { rank }) => sum + 1 / (fixture.k + rank), 0);
		const weighted = ranks.reduce((sum, { ranker, rank }) => sum + fixture.weights[ranker] / (fixture.k + rank), 0);
		const isr = coverage * ranks.reduce((sum, { rank }) => sum + 1 / rank ** 2, 0);
		return { id: document.id, coverage, scores: { S_RRF: rrf, S_w: weighted, S_ISR: isr, S_1: rrf * Math.log(coverage + 1) / Math.log(2), S_sat: saturatedRrf(rrf, coverage, workedSaturation) } };
	});
	const orders = Object.fromEntries(scoreIds.map((scoreId) => [scoreId, results.toSorted((left, right) => right.scores[scoreId] - left.scores[scoreId] || left.id.localeCompare(right.id)).map(({ id }) => id)])) as Record<ScoreId, string[]>;
	const textRanks = rankMaps["text embedding"];
	const multimodalRanks = rankMaps["multimodal embedding"];
	if (!(textRanks.D! < textRanks.F! && multimodalRanks.D! > multimodalRanks.F!)) throw new Error("fixture must retain the D/F ranker reversal witness");
	if (!(orders.S_RRF.indexOf("A") < orders.S_RRF.indexOf("B") && orders.S_ISR.indexOf("B") < orders.S_ISR.indexOf("A"))) throw new Error("fixture must retain the A/B fusion-order disagreement witness");
	return {
		fixture: { label: fixture.label, query: fixture.query, rankers: fixture.rankers, weights: fixture.weights, k: fixture.k, documents },
		rankMaps,
		methods: methodsFor(fixture),
		results,
		orders,
		comparisons: {
			rankerReversal: `D precedes F for text embedding (${textRanks.D} < ${textRanks.F}), while F precedes D for multimodal embedding (${multimodalRanks.F} < ${multimodalRanks.D}).`,
			methodDisagreement: "RRF ranks A above B, while ISR ranks B above A.",
		},
	};
}

function display(score: number): string {
	return (Math.trunc(score * 1_000) / 1_000).toFixed(3);
}

function resultFor(report: SimulationReport, documentId: string): SimulationResult {
	const result = report.results.find(({ id }) => id === documentId);
	if (!result) throw new Error(`missing result ${documentId} while rendering`);
	return result;
}

function renderOrder(report: SimulationReport, scoreId: ScoreId): string {
	return report.orders[scoreId]
		.map((documentId, index, order) => {
			if (index === 0) return documentId;
			const previous = resultFor(report, order[index - 1]).scores[scoreId];
			const current = resultFor(report, documentId).scores[scoreId];
			return `${current === previous ? " = " : " > "}${documentId}`;
		})
		.join("");
}

function unroundedMargin(report: SimulationReport, scoreId: ScoreId, higher: string, lower: string): string {
	const margin = resultFor(report, higher).scores[scoreId] - resultFor(report, lower).scores[scoreId];
	if (!(margin > 0)) throw new Error(`${scoreId} must rank ${higher} strictly above ${lower}`);
	return margin.toString();
}

/** Renders every numeric paper claim from the calculated report. */
export function renderSimulationSection(report: SimulationReport): string {
	const scores = report.results.map((result) => `| ${result.id} | ${result.coverage} | ${display(result.scores.S_RRF)} | ${display(result.scores.S_w)} | ${display(result.scores.S_ISR)} | ${display(result.scores.S_1)} | ${display(result.scores.S_sat)} |`).join("\n");
	const notation = (id: ScoreId) => id === "S_RRF" ? "S_{\\mathrm{RRF}}" : id === "S_ISR" ? "S_{\\mathrm{ISR}}" : id === "S_sat" ? "S_{\\mathrm{sat}}" : id;
	const orderRows = scoreIds.map((scoreId) => `| $${notation(scoreId)}$ | ${renderOrder(report, scoreId)} |`).join("\n");
	const closeComparisonRows = [
		{ scoreId: "S_RRF" as const, higher: "A", lower: "E" },
		{ scoreId: "S_RRF" as const, higher: "F", lower: "C" },
		{ scoreId: "S_w" as const, higher: "A", lower: "E" },
		{ scoreId: "S_1" as const, higher: "F", lower: "C" },
		{ scoreId: "S_sat" as const, higher: "F", lower: "C" },
	]
		.map(({ scoreId, higher, lower }) => `| $${notation(scoreId)}$ | ${higher} > ${lower} | ${unroundedMargin(report, scoreId, higher, lower)} |`)
		.join("\n");
	const isrB = resultFor(report, "B").scores.S_ISR;
	const isrC = resultFor(report, "C").scores.S_ISR;
	if (isrB !== isrC) throw new Error("S_ISR must retain the exact B/C tie witness");
	const weightList = report.fixture.rankers.map((ranker) => report.fixture.weights[ranker].toFixed(2)).join(", ");
	const weightedRankers = report.fixture.rankers.map((ranker) => `${ranker} ${report.fixture.weights[ranker].toFixed(2)}`).join(", ");
	const coverageGroups = Array.from({ length: report.fixture.rankers.length }, (_, index) => index + 1)
		.map((coverage) => ({ coverage, ids: report.results.filter((result) => result.coverage === coverage).map((result) => result.id) }))
		.filter(({ ids }) => ids.length > 0)
		.map(({ coverage, ids }) => `${ids.join(", ")} ${ids.length === 1 ? "has" : "have"} $|R_d|=${coverage}$`)
		.join("; ");
	const rankDescription = (documentId: string) => {
		const document = report.fixture.documents.find(({ id }) => id === documentId);
		if (!document) throw new Error(`missing document ${documentId} while rendering`);
		return report.fixture.rankers
			.filter((ranker) => document.ranks[ranker] !== null)
			.map((ranker) => `${ranker} rank ${document.ranks[ranker]}`)
			.join(", ");
	};
	const s1MatchesRrf = report.orders.S_1.every((documentId, index) => documentId === report.orders.S_RRF[index]);
	const s1Observation = s1MatchesRrf
		? `$S_1$ produces the same document order as RRF in this fixture (${report.orders.S_1.join(" > ")}), although that agreement is contingent on these ranks and coverages.`
		: `$S_1$ changes the RRF order in this fixture, producing ${report.orders.S_1.join(" > ")} after its coverage multiplier is applied.`;
	const saturatedObservation = `$S_{\\mathrm{sat}}$ also produces ${report.orders.S_sat.join(" > ")} at the worked setting $(a,b,t)=(3,0.1,2)$. Its positive $b$ slightly down-weights singleton coverage, while its bounded coverage multiplier approaches four rather than growing without bound; this corpus- and task-specific setting is not an optimum.`;

	return `## Simulation

This section uses one transparent calculation to make the effects of rank disagreement and retriever coverage concrete. It is a **synthetic, illustrative** example rather than a benchmark or relevance evaluation: the rankers are mocked, and no embedding model is executed. That scope is appropriate here because the purpose is to compare the five scoring rules under a controlled set of ranks, while keeping every input small enough to inspect directly.

### Synthetic setup

The *${report.fixture.label.replace(" (synthetic)", "")}* asks “${report.fixture.query}” and supplies three plausible top-five views of seven candidate documents. The lexical ranker represents exact-term matching, the text embedding ranker represents semantic similarity in written content, and the multimodal embedding ranker represents visual as well as textual similarity. Their rankings are deliberately constructed rather than measured: they create singleton results, partial overlap, full agreement, and a pairwise reversal in one compact fixture.

\`\`\`{=typst}
#import "../figures/worked-example-tables.typ": worked-example-tables
#worked-example-tables()
\`\`\`

The disagreement is visible before fusion. ${report.comparisons.rankerReversal} The text-oriented view can reasonably prefer an inspection photo guide with a descriptive caption, while the multimodal view can prefer a wiring diagram whose visual structure closely matches equipment inspection. The example therefore treats rankers as representation-specific retrievers, not as interchangeable replicas.

### Reading ranker coverage

Each number is a one-based position within that ranker's returned top five. An em dash means that the ranker did not return the document in its top five; it does not mean that the document is irrelevant, has rank zero, or received a zero-valued model score. The coverage count $|R_d|$ is simply the number of rankers that returned the document. In this fixture, ${coverageGroups}. This distinction matters because every simulated rule receives contributions only from rankers in $I_d$, while some rules add a further coverage multiplier.

All five scores are calculated from this same rank table. $S_{\\mathrm{RRF}}$ uses $k=${report.fixture.k}$, and weighted RRF uses $w=[${weightList}]$ in ranker order (${weightedRankers}). The score table truncates values to exactly three digits after the decimal for readability. Full precision is retained for sorting and order comparisons, so displayed ties do not imply computational ties.

<!-- Generated score rows retained here as an audit surface for the hand-authored Typst table.
Table: Generated document scores, truncated to three decimal places.

| Document | $|R_d|$ | $S_{\\mathrm{RRF}}$ | $S_w$ | $S_{\\mathrm{ISR}}$ | $S_1$ | $S_{\\mathrm{sat}}$ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${scores}
-->

### What the scoring rules emphasize

Plain RRF sums one damped reciprocal contribution for every returned rank. With $k=${report.fixture.k}$ and ranks confined to the top five, the denominators are close, so additional supporting rankers can matter more than small differences in position. Weighted RRF retains that kernel but assigns prior importance to the retrievers; here the lexical ranker receives the largest weight, followed by text embedding and multimodal embedding. ISR instead uses an inverse-square rank kernel and multiplies the result by coverage, making head ranks much more influential while also rewarding agreement aggressively. $S_1$ starts from plain RRF and applies the one-retriever-normalized logarithmic multiplier $C_{\\mathrm{log}}(R_d;1,1/\\ln2)$. $S_{\\mathrm{sat}}$ instead applies the bounded multiplier $C_{\\mathrm{sat}}(R_d;3,0.1,2)$. At the worked setting $(a,b,t)=(3,0.1,2)$, positive $b$ slightly down-weights singleton coverage and the multiplier approaches four. This is bounded coverage promotion, not a globally bounded full score.

Table 1 gives each rule's provenance and boundary behavior. Its “bounded coverage bonus” claim applies to the saturated multiplier, not to the complete simulation score: the underlying RRF sum can still accumulate positive terms.

### Observed fusion behavior

The right side of Table 3 gives each method's document order, sorted from the
full-precision scores.

<!-- Generated order rows retained here as an audit surface for the hand-authored Typst table.
Table: Full-precision document order under each scoring rule.

| Method | Document order |
| --- | --- |
${orderRows}
-->

Several strict comparisons disappear in the three-decimal score table. The generated margins below retain the unrounded difference between the higher and lower score, making each ordering decision auditable without adding digits to the main table.

Table: Strict comparisons hidden by three-decimal score display.

| Method | Strict comparison | Unrounded margin (higher minus lower) |
| --- | --- | ---: |
${closeComparisonRows}

ISR is different: B and C tie exactly at ${isrB.toString()}, rather than merely appearing equal after truncation. B has one rank-one contribution with coverage one, while C has two rank-two contributions with coverage two; therefore both evaluate to one under $|R_d|\\sum_{i \\in I_d}1/r_i(d)^2$. The order table displays that equality as B = C, while the report's deterministic internal ordering still lists B before C.

The orders expose two different kinds of disagreement. First, the input-level D/F reversal shows, in this fixture, that the representation being searched can change the order. Second, ${report.comparisons.methodDisagreement} A receives ${rankDescription("A")}, whereas B receives only ${rankDescription("B")}. RRF's damped denominators let A's cross-ranker support outweigh B's single head rank; ISR's inverse-square kernel gives that rank-one singleton enough leverage to reverse the pair.

The weights create a smaller but instructive change. Weighted RRF gives the lexical retriever's contribution the largest prior weight, which places C (${rankDescription("C")}) above F (${rankDescription("F")}); plain RRF places F just above C. The change is not a generic benefit of weighting—it is the direct consequence of assigning the lexical retriever the greatest weight in this scenario. ${s1Observation} Here $S_1$ enlarges the separation associated with broader coverage without introducing an additional reversal. ${saturatedObservation}

For the stated inspection-help query, the illustrative local judgment is **A above B**: a guide supported by all three channels is more explanatory than a lexical-only tax-credit FAQ match. That judgment motivates the pairwise inspection; it is not used as ground truth for the remaining documents.

### What this example establishes

The calculation establishes that the same D/F pair can reverse between rankers and that the same A/B pair can reverse between fusion rules even when every rule consumes one fixed rank table. It also shows concretely how fixed weights can exchange C and F, and how $S_1$ and $S_{\\mathrm{sat}}$ behave relative to RRF on this fixture. Because the inputs, scores, and orders come from one generated report, the observations can be reproduced and audited without running retrieval models.

The example does not establish retrieval quality, statistical significance, optimal values of $k$ or $w$, or superiority of one fusion rule. It has no corpus sampling protocol, trained rankers, relevance judgments, or evaluation metric, and its seven documents were chosen to expose mechanisms rather than estimate real-world frequency. A benchmark study would need canonical data, actual model runs, qrels, repeated queries, and task-appropriate metrics; those empirical claims remain outside the scope of this simulation.
`;
}

function outputPath(arguments_: readonly string[]): string {
	const outputIndex = arguments_.indexOf("--output");
	if (outputIndex === -1 || !arguments_[outputIndex + 1]) throw new Error("usage: node simulate-ranking-fusion.ts --output <path>");
	return resolve(arguments_[outputIndex + 1]);
}

if (import.meta.main) {
	try {
		const report = calculateSimulation(illustrativeHomeEnergyFixture);
		const path = outputPath(process.argv.slice(2));
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, renderSimulationSection(report));
		process.stdout.write(`${JSON.stringify(report)}\n`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
