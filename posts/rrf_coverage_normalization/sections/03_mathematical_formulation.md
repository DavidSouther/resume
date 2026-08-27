## Mathematical Formulation

A common notation makes the fusion rules directly comparable. Let
$I=\{1,\ldots,m\}$ be the finite retriever-index set, where
$m\in\mathbb{N}_{+}$ and therefore $I\subset\mathbb{Z}$. Here $d$ is a document,
not a numeric variable. Its supporting-retriever set and realized
coverage are

$$
I_d = \{i \in I : i \text{ ranks } d\}, \qquad
n(d) = |I_d| \in \{0,\ldots,m\}\subset\mathbb{Z}_{\geq 0}.
$$

On the returned-document domain,
$n(d)\in\{1,\ldots,m\}\subset\mathbb{N}_{+}$; the case $n(d)=0$ is reserved
for the boundary extension. For $i\in I_d$,
$r_i(d)\in\mathbb{N}_{+}$ is the one-based rank of $d$ under retriever $i$.

The rank-damping constant is $k\in\mathbb{R}_{>0}$. A fixed retriever weight
is $w_i\in\mathbb{R}_{\geq 0}$, and the RBC persistence parameter is
$\phi\in[0,1)\subset\mathbb{R}$. The additive logarithmic shift is
$b_s\in\mathbb{R}_{\geq 0}$. Separately, the logarithm-base parameter is
$b_\ell\in\mathbb{R}_{>1}$, with the positive change-of-base scale

$$
B=\frac{1}{\ln(b_\ell)}\in\mathbb{R}_{>0}.
$$

The rank kernel $q_\phi:\mathbb{N}_{+}\to\mathbb{R}_{\geq 0}$ and each named score
below are real-valued and nonnegative on their stated domains.

### Plain RRF

The plain Reciprocal Rank Fusion score is

$$
S_{\mathrm{RRF}}(d) = \sum_{i \in I_d} \frac{1}{k + r_i(d)}.
$$

Each retriever that contains the document contributes one reciprocal-rank term,
as specified by Cormack, Clarke, and Buettcher [@cormack2009].

### Coverage division

For $n(d)\geq 1$, the coverage-division score is

$$
S_{\mathrm{avg}}(d) = \frac{S_{\mathrm{RRF}}(d)}{n(d)}.
$$

It is the mean contribution from the RRF reciprocal-rank kernel
[@cormack2009] across the retrievers that contain the document. Coverage
division is a comparator, not an established RRF variant.

### Fixed retriever weights

The fixed-retriever-weight score is

$$
S_w(d) = \sum_{i \in I_d} \frac{w_i}{k + r_i(d)}.
$$

A weight changes a retriever's prior influence. Azure AI Search documents this
weighting model for vector queries [@azureVectorWeighting].

### Rank-Biased Centroid

The Rank-Biased Centroid score is

$$
S_{\mathrm{RBC}}(d; \phi) = \sum_{i \in I_d} q_\phi(r_i(d)),
$$

where the endpoint at $\phi = 0$ is defined by continuous extension:

$$
q_\phi(r) =
\begin{cases}
(1-\phi)\phi^{r-1}, & 0 < \phi < 1, \\
1, & \phi = 0 \text{ and } r = 1, \\
0, & \phi = 0 \text{ and } r > 1.
\end{cases}
$$

Thus, at $\phi=0$, rank 1 contributes 1 and every later rank contributes 0;
no interpretation of $0^0$ is required. The geometric rank kernel comes from
Bailey et al.'s RBC formulation [@bailey2017].

### Additive shifted-log branch

For $b_s\geq0$ and returned documents with $n(d)\geq1$, the additive
shifted-log score is

$$
S_{\mathrm{shift}}(d; b_s)
= S_{\mathrm{RRF}}(d)\ln(n(d) + b_s).
$$

It combines the RRF kernel [@cormack2009] with a shifted logarithmic coverage
multiplier. Mourao, Martins, and Magalhaes's logN ISR supplies a formula-level
logarithmic precedent, but uses an inverse-square rank kernel rather than the
RRF kernel [@mourao2014].

### Base-log branch

For $b_\ell>1$ and returned documents with $n(d)\geq1$, the base-log score is

$$
S_{\mathrm{base}}(d; b_\ell)
= S_{\mathrm{RRF}}(d)\log_{b_\ell}(n(d))
= B S_{\mathrm{RRF}}(d)\ln(n(d)).
$$

This comparator likewise combines the RRF kernel [@cormack2009] with the
logarithmic-coverage precedent of logN ISR [@mourao2014], whose inverse-square
rank kernel remains materially different.

### Boundary and coverage analysis

The returned-document domain is $n(d) \geq 1$.
The singleton multiplier is positive for every $b_s > 0$.
The zero-coverage logarithm $\ln(b_s)$ is finite for $b_s > 0$.
The empty RRF sum makes the extended score zero.
This finite extension is useful for boundary analysis, but it does not add an unreturned document to the normative domain.

The shift controls the multiplier at the boundary.
When $0 < b_s < 1$, $\ln(b_s)$ is negative.
When $b_s = 1$, $\ln(b_s)$ is zero.
When $b_s > 1$, $\ln(b_s)$ is positive.
These zero-coverage signs do not change the extended score because the RRF factor is zero.
As $b_s$ approaches zero, $\ln(1+b_s)$ approaches zero.
At $b_s = 1$, the singleton multiplier is $\ln(2)$.

For fixed finite $I$, the large-shift limit is

$$
\frac{S_{\mathrm{shift}}(d; b_s)}{\ln b_s}
= S_{\mathrm{RRF}}(d)\frac{\ln(n(d)+b_s)}{\ln b_s}
\longrightarrow S_{\mathrm{RRF}}(d)
\qquad (b_s \to \infty),
$$

uniformly over the fixed finite coverage range $1 \leq n(d) \leq |I|$.
Consequently, finite-$b_s$ ordering converges to every strict, non-tied plain-RRF
comparison. Documents tied by plain RRF can still be differentiated by coverage
at finite $b_s$. This fixed-range statement does not claim that the logarithm is
globally bounded.

Fixed weights are independent of $n(d)$.
Fixed weights do not normalize realized coverage.
They encode prior retriever influence, while $n(d)$ records how many retrievers
returned the document.

The logarithmic multiplier has diminishing increments.
Across a family in which the number of supporting retrievers grows while their
ranks remain equal, plain RRF grows in proportion to $n$, and the candidate
grows in proportion to $n\ln(n+b_s)$. Thus the total coverage reward is unbounded
across that growing-retriever family; for any fixed finite $I$, it is bounded.
This is not a division-style normalization.
