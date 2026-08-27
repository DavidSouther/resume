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
