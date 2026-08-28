## Worked Example

To see the effects of the retrieval fusion models, we show here a
representative data set & query. The *home-energy fixture* is a sample
corpus set of six documents provided by a solar home energy provider. In
this example, we rank these documents across three separate retrievers for a
single query to show how each fusion technique adjusts the final rankings.

The hypothetical query for this ranking is "How do I inspect an installation?".
The retrievers aren't strictly important, but provide context for typical
document retrieval rankers. A lexical ranker will match keyword position and
frequency, such as BM25 [citation]. Text and multimodal embedding models are
machine learning models consisting of tens to hundreds of millions of neural
network parameters, and have differing performance across language and media
corpus based on their training data [citation].

```{=typst}
#import "../figures/worked-example-tables.typ": worked-example-tables
#worked-example-tables()
```

The disagreement is visible before fusion. D precedes F for text embedding (1 < 3),
while F precedes D for multimodal embedding (1 < 2). The text-oriented view can
reasonably prefer an inspection photo guide with a descriptive caption, while the
multimodal view can prefer a wiring diagram whose visual structure closely matches equipment inspection. The example therefore whos rankers provide differeing evidence channels, and are not
simply interchangeable comparators.

### Reading ranker coverage

Each number is a one-based position within that ranker's returned top five. An em dash means that the ranker did not return the document in its top five; it does not mean that the document is irrelevant, has rank zero, or received a zero-valued model score. The coverage count $|d|$ is simply the number of rankers that returned the document. In this fixture, B, G have $|d|=1$; C, F have $|d|=2$; A, D, E have $|d|=3$. This distinction matters because every simulated rule receives contributions only from rankers in $I_d$, while some rules add a further coverage multiplier.

All four scores are calculated from this same rank table. $S_{\mathrm{RRF}}$ uses $k=60$, and weighted RRF uses $w=[0.45, 0.30, 0.25]$ in ranker order (lexical 0.45, text embedding 0.30, multimodal embedding 0.25). The score table truncates values to exactly three digits after the decimal for readability. Full precision is retained for sorting and order comparisons, so displayed ties do not imply computational ties.

The side-by-side table above gives the full-precision score orders next to the evidence that produced them.

Plain RRF sums one damped reciprocal contribution for every returned rank. With $k=60$ and ranks confined to the top five, the denominators are close, so additional supporting rankers can matter more than small differences in position. Weighted RRF retains that kernel but assigns prior importance to the evidence channels; here the lexical ranker receives the largest weight, followed by text embedding and multimodal embedding. ISR instead uses an inverse-square rank kernel and multiplies the result by coverage, making head ranks much more influential while also rewarding agreement aggressively. $S_1$ starts from plain RRF and applies the singleton-normalized logarithmic factor $\ln(|d|+1)/\ln 2$: singleton scores remain equal to their RRF values, while added coverage receives a positive but diminishing multiplier.

Several strict comparisons occure at 5 or 6 decimals of precision, truncated from the three decimal precision in the side-by-side table above. Reviewing these differences to 6 digits shows further subtleties across the techniques.

Table: Unrounded margins for strict comparisons that are visually compressed by the three-decimal score display. {#tbl:strict-margins}

| Method | Strict comparison | Unrounded margin (higher minus lower) |
| --- | --- | ---: |
| $S_{\mathrm{RRF}}$ | A > E | 0.000721 |
| $S_{\mathrm{RRF}}$ | F > C | 0.000008 |
| $S_w$              | A > E | 0.000240 |
| $S_1$              | F > C | 0.000013 |

ISR is different: B and C tie exactly at 1, rather than merely appearing equal after truncation. B has one rank-one contribution with coverage one, while C has two rank-two contributions with coverage two; therefore both evaluate to one under $|d|\sum_{i \in I_d}1/r_i(d)^2$. The order table displays that equality as B = C, while the report's deterministic internal ordering still lists B before C.

The orders expose two different kinds of disagreement. First, the input-level D/F reversal survives as evidence that document preference depends on the representation being searched. Second, RRF ranks A above B, while ISR ranks B above A. A receives lexical rank 4, text embedding rank 4, multimodal embedding rank 4, whereas B receives only lexical rank 1. RRF's damped denominators let A's cross-ranker support outweigh B's single head rank; ISR's inverse-square kernel gives that rank-one singleton enough leverage to reverse the pair.

The weights create a smaller but instructive change. Weighted RRF gives lexical evidence the largest prior weight, which places C (lexical rank 2, text embedding rank 2) above F (text embedding rank 3, multimodal embedding rank 1); plain RRF places F just above C. The change is not a generic benefit of weighting—it is the direct consequence of declaring lexical evidence more important in this scenario. $S_1$ produces the same document order as RRF in this fixture (D > A > E > F > C > B > G), although that agreement is contingent on these ranks and coverages. Here $S_1$ enlarges the separation associated with broader coverage without introducing an additional reversal.

For the stated inspection-help query, the illustrative local judgment is **A above B**: a guide supported by all three channels is more explanatory than the lexical-only FAQ result. That judgment motivates the pairwise inspection.

### What this example establishes

The calculation establishes that the same D/F pair can reverse between rankers and that the same A/B pair can reverse between fusion rules even when every rule consumes one fixed rank table. It also shows concretely how fixed weights can exchange C and F, and how $S_1$ behaves relative to RRF on this fixture. Because the inputs, scores, and orders come from one generated report, the observations can be reproduced and audited without running retrieval models.

The example does not establish retrieval quality, statistical significance, optimal values of $k$ or $w$, or superiority of one fusion rule. It has no corpus sampling protocol, trained rankers, relevance judgments, or evaluation metric, and its seven documents were chosen to expose mechanisms rather than estimate real-world frequency. A benchmark study would need canonical data, actual model runs, qrels, repeated queries, and task-appropriate metrics; those empirical claims remain outside the scope of this simulation.
