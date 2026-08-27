## Mathematical Formulation

This section uses one notation for all fusion rules.

I is the retriever-index set.
I_d contains the retrievers whose rankings contain document d.
n(d) = |I_d|.
r_i(d) is the one-based rank of d under retriever i.
k > 0.
w_i >= 0.
0 <= phi < 1.
b > 0.
log is the natural logarithm.

### Plain RRF

Plain Reciprocal Rank Fusion uses
`S_RRF(d) = sum_{i in I_d} 1/(k+r_i(d))`. Each retriever that contains the
document contributes one reciprocal-rank term [@cormack2009].

Evidence tier: primary paper.

### Coverage division

For n(d) >= 1, this paper defines
`S_avg(d) = S_RRF(d)/n(d)`. It is the mean RRF contribution across the
retrievers that contain the document. The reciprocal-rank kernel comes from
plain RRF [@cormack2009]. Coverage division is a comparator defined by this
paper. It is not an established RRF variant.

Evidence tier: paper-defined comparator.

### Fixed retriever weights

Fixed retriever weights give
`S_w(d) = sum_{i in I_d} w_i/(k+r_i(d))`. A weight changes a retriever's prior
influence. Azure AI Search documents this weighting model for vector queries
[@azureVectorWeighting].

Evidence tier: official documentation.

### Rank-Biased Centroid

Rank-Biased Centroid uses
`S_RBC(d) = sum_{i in I_d} (1-phi)phi^(r_i(d)-1)`. Its geometric rank kernel
comes from the primary RBC paper [@bailey2017].

Evidence tier: primary paper.

### Shifted-log candidate

This paper proposes
`S_log(d; b) = S_RRF(d) log(n(d)+b)`. It combines the RRF kernel
[@cormack2009] with a shifted logarithmic coverage multiplier. The closest
confirmed formula-level precedent is logN ISR [@mourao2014]. logN ISR uses an
inverse-square rank kernel. It does not use the RRF kernel.

Evidence tier: this paper's proposal.

### Boundary and coverage analysis

The returned-document domain is n(d) >= 1.
The singleton multiplier is positive for every b > 0.
The zero-coverage logarithm log(b) is finite for b > 0.
The empty RRF sum makes the extended score zero.
This finite extension is useful for boundary analysis, but it does not add an unreturned document to the normative domain.

The shift controls the multiplier at the boundary.
When 0 < b < 1, log(b) is negative.
When b = 1, log(b) is zero.
When b > 1, log(b) is positive.
These zero-coverage signs do not change the extended score because the RRF factor is zero.
As b approaches zero, log(1+b) approaches zero.
At b = 1, the singleton multiplier is log(2).

Over a fixed finite coverage range, the multiplier becomes nearly constant.
As b increases, ordering approaches scaled plain RRF.
This statement concerns a fixed finite range of n(d); it does not claim that the logarithm is globally bounded.

Fixed weights are independent of n(d).
Fixed weights do not normalize realized coverage.
They encode prior retriever influence, while n(d) records how many retrievers returned the document.

The logarithmic multiplier has diminishing increments.
At equal ranks, plain RRF grows in proportion to n.
At equal ranks, the candidate grows in proportion to n log(n+b).
The total coverage reward is unbounded.
This is not a division-style normalization.
