## Comparisons & Simulations

We begin by asking what the specific $S_{\mathrm{log}}(d;1,1/\ln(2))$ and
$S_{\mathrm{sat}}(d;3,0.1,2)$ do when several retrievers return the same
candidate at different depths. Figure 1 normalizes each method against a
document returned by a single retriever at rank 1. A document returned once
at rank 100 is generally considered a weak candidate for the query, but
introducing agreement coupling changes the result: one document ranked by
two retrievers at rank 100 scores slightly higher than a document with a
single retriever ranking it 1. Three mixed occurrences at ranks $(100,500,1000)$
also narrowly beat that single retriever rank 1 document. Logarithmic and
saturating RRF explicitly favors candidates corroborated
across retrievers, even when no single retriever places the candidate at the head
of its list.

Figure 2 shows five methods: logarithmic RRF, saturating RRF,
Rank-Biased Centroid, ISR, and logISR. Each
panel shows the same seven profiles. Its base-10 ratios use each method's
stated baseline. Four panels use one rank-1 appearance; logISR uses $(1,1)$
because its single retriever score is zero.
RBC at $\phi=0.7$ is effectively controlled by the shallowest rank: evidence
at ranks 300--1000 adds almost nothing to a rank-100 match. ISR rewards
additional retrievers, but its inverse-square kernel still lets a rank-1,
single-retriever document dominate every mid-to-deep profile shown. The saturated
series instead keeps the reciprocal rank kernel and applies its bounded
coverage multiplier. logISR exposes its one-retriever degeneracy: any document
with a single retriever receives score zero, so any candidate returned by two retrievers
beats every one-retriever candidate regardless of rank. Among multi-retriever
candidates, inverse-square rank quality again dominates.

Together the five panels separate two choices that are easy to conflate. The rank
kernel decides how much evidence survives at depth; the coverage factor decides
how strongly apparent retriever agreement changes the final order. At the
plotted settings, logarithmic RRF and saturated RRF both retain substantial
mid-rank evidence and promote cross-retriever agreement without erasing
single-retriever documents. Their coverage behavior differs: the logarithmic factor
keeps growing, while the saturated multiplier approaches a maximum and its positive
$b$ slightly down-weights single retriever coverage.

## Simulation

This section uses one transparent calculation to make the effects of rank disagreement and retriever coverage concrete. It is a **synthetic, illustrative** example rather than a benchmark or relevance evaluation: the rankers are mocked, and no embedding model is executed. That scope is appropriate here because the purpose is to compare the five scoring rules under a controlled set of ranks, while keeping every input small enough to inspect directly.

### Synthetic setup

The *Illustrative home-energy retrieval fixture* asks “how do I inspect a residential rooftop solar installation?” and supplies three plausible top-five views of seven candidate documents. The lexical ranker represents exact-term matching, the text embedding ranker represents semantic similarity in written content, and the multimodal embedding ranker represents visual as well as textual similarity. Their rankings are deliberately constructed rather than measured: they create results with single retrievers, partial overlap, full agreement, and a pairwise reversal in one compact fixture.

```{=typst}
#import "../figures/worked-example-tables.typ": worked-example-tables
#worked-example-tables()
```

The disagreement is visible before fusion. D precedes F for text embedding (1 < 3), while F precedes D for multimodal embedding (1 < 2). The text-oriented view can reasonably prefer an inspection photo guide with a descriptive caption, while the multimodal view can prefer a wiring diagram whose visual structure closely matches equipment inspection. The example therefore treats rankers as different evidence channels, not as interchangeable replicas.

### Reading ranker coverage

Each number is a one-based position within that ranker's returned top five. An em dash means that the ranker did not return the document in its top five; it does not mean that the document is irrelevant, has rank zero, or received a zero-valued model score. The coverage count $|R_d|$ is simply the number of rankers that returned the document. In this fixture, B, G have $|R_d|=1$; C, F have $|R_d|=2$; A, D, E have $|R_d|=3$. This distinction matters because every simulated rule receives contributions only from rankers in $I_d$, while some rules add a further coverage multiplier.

All five scores are calculated from this same rank table. $S_{\mathrm{RRF}}$ uses $k=60$, and weighted RRF uses $w=[0.45, 0.30, 0.25]$ in ranker order (lexical 0.45, text embedding 0.30, multimodal embedding 0.25). The score table truncates values to exactly three digits after the decimal for readability. Full precision is retained for sorting and order comparisons, so displayed ties do not imply computational ties.

<!-- Generated score rows retained here as an audit surface for the hand-authored Typst table.
Table: Generated document scores, truncated to three decimal places.

| Document | $|R_d|$ | $S_{\mathrm{RRF}}$ | $S_w$ | $S_{\mathrm{ISR}}$ | $S_1$ | $S_{\mathrm{sat}}$ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 3 | 0.046 | 0.015 | 0.562 | 0.093 | 0.133 |
| B | 1 | 0.016 | 0.007 | 1.000 | 0.016 | 0.013 |
| C | 2 | 0.032 | 0.012 | 1.000 | 0.051 | 0.067 |
| D | 3 | 0.048 | 0.016 | 4.083 | 0.096 | 0.137 |
| E | 3 | 0.046 | 0.015 | 0.360 | 0.092 | 0.131 |
| F | 2 | 0.032 | 0.008 | 2.222 | 0.051 | 0.067 |
| G | 1 | 0.015 | 0.003 | 0.111 | 0.015 | 0.013 |
-->

### What the scoring rules emphasize

Plain RRF sums one damped reciprocal contribution for every returned rank. With $k=60$ and ranks confined to the top five, the denominators are close, so additional supporting rankers can matter more than small differences in position. Weighted RRF retains that kernel but assigns prior importance to the evidence channels; here the lexical ranker receives the largest weight, followed by text embedding and multimodal embedding. ISR instead uses an inverse-square rank kernel and multiplies the result by coverage, making head ranks much more influential while also rewarding agreement aggressively. $S_1$ starts from plain RRF and applies the single retriever normalized logarithmic factor $S_{\mathrm{cov}} = $. $S_{\mathrm{sat}}$ instead applies the bounded coverage multiplier $1+a(1-\exp((1+b-|R_d|)/t))$. At the worked setting $(a,b,t)=(3,0.1,2)$, positive $b$ slightly down-weights singleton coverage and the multiplier approaches four. This is bounded coverage promotion, not a globally bounded full score.

Table 1 gives each rule's provenance and boundary behavior. Its “bounded coverage bonus” claim applies to the saturated multiplier, not to the complete simulation score: the underlying RRF sum can still accumulate positive terms.

### Observed fusion behavior

The right side of Table 3 gives each method's document order, sorted from the
full-precision scores.

<!-- Generated order rows retained here as an audit surface for the hand-authored Typst table.
Table: Full-precision document order under each scoring rule.

| Method | Document order |
| --- | --- |
| $S_{\mathrm{RRF}}$ | D > A > E > F > C > B > G |
| $S_w$ | D > A > E > C > F > B > G |
| $S_{\mathrm{ISR}}$ | D > F > B = C > A > E > G |
| $S_1$ | D > A > E > F > C > B > G |
| $S_{\mathrm{sat}}$ | D > A > E > F > C > B > G |
-->

Several strict comparisons disappear in the three-decimal score table. The generated margins below retain the unrounded difference between the higher and lower score, making each ordering decision auditable without adding digits to the main table.

Table: Strict comparisons hidden by three-decimal score display.

| Method | Strict comparison | Unrounded margin (higher minus lower) |
| --- | --- | ---: |
| $S_{\mathrm{RRF}}$ | A > E | 0.000721 |
| $S_{\mathrm{RRF}}$ | F > C | 0.000008 |
| $S_w$              | A > E | 0.000240 |
| $S_1$              | F > C | 0.000013 |
| $S_{\mathrm{sat}}$ | F > C | 0.000017 |

ISR is different: B and C tie exactly at 1, rather than merely appearing equal after truncation. B has one rank-one contribution with coverage one, while C has two rank-two contributions with coverage two; therefore both evaluate to one under $|R_d|\sum_{i \in I_d}1/r_i(d)^2$. The order table displays that equality as B = C, while the report's deterministic internal ordering still lists B before C.

The orders expose two different kinds of disagreement. First, the input-level D/F reversal survives as evidence that document preference depends on the representation being searched. Second, RRF ranks A above B, while ISR ranks B above A. A receives lexical rank 4, text embedding rank 4, multimodal embedding rank 4, whereas B receives only lexical rank 1. RRF's damped denominators let A's cross-ranker support outweigh B's single head rank; ISR's inverse-square kernel gives that rank-one singleton enough leverage to reverse the pair.

The weights create a smaller but instructive change. Weighted RRF gives lexical evidence the largest prior weight, which places C (lexical rank 2, text embedding rank 2) above F (text embedding rank 3, multimodal embedding rank 1); plain RRF places F just above C. The change is not a generic benefit of weighting—it is the direct consequence of declaring lexical evidence more important in this scenario. $S_1$ produces the same document order as RRF in this fixture (D > A > E > F > C > B > G), although that agreement is contingent on these ranks and coverages. Here $S_1$ enlarges the separation associated with broader coverage without introducing an additional reversal. $S_{\mathrm{sat}}$ also produces D > A > E > F > C > B > G at the worked setting $(a,b,t)=(3,0.1,2)$. Its positive $b$ slightly down-weights singleton coverage, while its bounded coverage multiplier approaches four rather than growing without bound; this corpus- and task-specific setting is not an optimum.

For the stated inspection-help query, the illustrative local judgment is **A above B**: a guide supported by all three channels is more explanatory than a lexical-only tax-credit FAQ match. That judgment motivates the pairwise inspection; it is not used as ground truth for the remaining documents.

### What this example establishes

The calculation establishes that the same D/F pair can reverse between rankers and that the same A/B pair can reverse between fusion rules even when every rule consumes one fixed rank table. It also shows concretely how fixed weights can exchange C and F, and how $S_1$ and $S_{\mathrm{sat}}$ behave relative to RRF on this fixture. Because the inputs, scores, and orders come from one generated report, the observations can be reproduced and audited without running retrieval models.

The example does not establish retrieval quality, statistical significance, optimal values of $k$ or $w$, or superiority of one fusion rule. It has no corpus sampling protocol, trained rankers, relevance judgments, or evaluation metric, and its seven documents were chosen to expose mechanisms rather than estimate real-world frequency. A benchmark study would need canonical data, actual model runs, qrels, repeated queries, and task-appropriate metrics; those empirical claims remain outside the scope of this simulation.
