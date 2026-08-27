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

A better rank means a smaller $r_i(d)$ and therefore increases that
retriever's contribution. Increasing $k$ lowers every contribution and
compresses the contrast between early and late ranks: the additive constant
makes a one-position rank difference smaller relative to the denominator.
Every extra supporting retriever adds a positive term, so enough additional
support can overcome weaker individual ranks and change the document order.
Thus $k$ is a rank-damping constant, not a coverage normalizer; it controls how
sharply rank differences matter but does not remove the reward for being found
by more retrievers.

### Coverage division

For $n(d)\geq 1$, the coverage-division score is

$$
S_{\mathrm{avg}}(d) = \frac{S_{\mathrm{RRF}}(d)}{n(d)}.
$$

It is the mean contribution from the RRF reciprocal-rank kernel
[@cormack2009] across the retrievers that contain the document. Coverage
division is a comparator, not an established RRF variant.

Ranks and $k$ affect each reciprocal-rank contribution exactly as in plain RRF,
but division turns their sum into a mean. If another retriever contributes
$x=1/(k+r)$, then a contribution that exceeds the current mean raises the new
mean, one below it lowers the new mean, and one equal to it leaves the mean
unchanged. In particular, when all supporting retrievers return a document at
equal ranks, the score is
invariant to $n$: repeating the same contribution changes the amount of support
but not its average quality. This removes the automatic reward for agreement,
which makes rank quality comparable across different realized coverages, but it
can also discard useful consensus evidence when repeated independent support
ought to strengthen a result.

### Fixed retriever weights

The fixed-retriever-weight score is

$$
S_w(d) = \sum_{i \in I_d} \frac{w_i}{k + r_i(d)}.
$$

A weight changes a retriever's prior influence. Azure AI Search documents this
weighting model for vector queries [@azureVectorWeighting].

The score is linear in each $w_i$: doubling one retriever's weight doubles only
its contribution, while a zero weight removes that retriever from the score.
For any positive weight, a better rank increases its reciprocal contribution,
whereas increasing $k$ lowers it and damps the difference between ranks.
Additional support remains additive, although its effect now depends on which
retriever supplied it and that retriever's prior weight. Multiplying all weights
by one positive constant rescales every document score without changing their
order; changing relative weights can change the order by favoring one
retriever's evidence over another's. Fixed weights therefore encode prior trust
or importance. They are not realized-coverage normalization, because the
weights do not adapt to how many retrievers happened to return a document.

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

For $0<\phi<1$, each one-rank descent multiplies a retriever's contribution by
$\phi$, giving the kernel its geometric browsing-depth interpretation. At
$\phi=0$, only rank one contributes. A larger $\phi$ makes decay through the
ranked list slower, but it simultaneously reduces the rank-one mass $1-\phi$.
Consequently, larger $\phi$ does not uniformly increase every contribution.
For a fixed rank $r>1$, $(1-\phi)\phi^{r-1}$ is not globally monotone in
$\phi$: it increases up to

$$
\phi=\frac{r-1}{r},
$$

and decreases thereafter. The parameter therefore moves attention from the
head toward deeper ranks rather than acting as a global score multiplier.
Additional supporting retrievers still add nonnegative mass, so agreement can
raise a document even when the geometric decay strongly favors early ranks.

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

For fixed $n(d)$, ranks and $k$ act entirely through
$S_{\mathrm{RRF}}(d)$: better ranks raise the score and a larger $k$ damps it.
For a fixed RRF score, increasing coverage increases the multiplier, while its
marginal coverage increments diminish because $\ln$ is concave. Increasing
$b_s$ also increases the multiplier, but it changes cross-coverage comparisons
because the relative multipliers for two coverage levels change with the
shift. Giving documents the same $n(d)$ gives them one positive multiplier and
therefore preserves their RRF order. The exception is $b_s=0$ with $n(d)=1$,
where that multiplier is zero and all singleton scores collapse to a zero tie.
This branch therefore keeps rank evidence while adding a tunable, sublinear
reward for realized agreement; it does not divide away coverage.

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

Equivalently, the change-of-base form used to expose its sensitivity is

$$
S_{\mathrm{base}}(d; b_\ell)
= B S_{\mathrm{RRF}}(d)\ln(n(d)).
$$

For $n(d)>1$, rank and $k$ affect the score through the RRF factor just as in
the additive branch, while increasing $n(d)$ raises the $\ln(n(d))$ coverage
factor. Every singleton has $\ln(1)=0$ and therefore scores zero, regardless of
rank. When $B>0$ is global, it only rescales all documents and cannot change a
ranking. Equivalently, increasing the base $b_\ell$ decreases
$B=1/\ln(b_\ell)$, changing score magnitude but not order. The consequential
choice is the $\ln n$ shape itself: it suppresses all singleton evidence and
then rewards broader support. That singleton and coverage policy is
qualitatively different from the additive shift, whose $b_s$ can retain a
positive singleton multiplier.

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
