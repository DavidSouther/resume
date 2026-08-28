## Mathematical Formulation

For a common notation, we separate three kinds of quantities. Retriever indices and
coverage counts are integers: $I=\{1,\ldots,m\}$ is the finite
retriever-index set, $m\in\mathbb{N}_{+}$, $I\subset\mathbb{Z}$, and

$$
\begin{aligned}
I_d &= \{i \in I : i \text{ ranks } d\} \\
|R_d| &= |I_d| \in \{0,\ldots,m\}\subset\mathbb{Z}_{\geq 0}
\end{aligned}
$$

Here $d$ is a document, not a numeric variable. On the returned document
domain, $|R_d|\in\{1,\ldots,m\}\subset\mathbb{N}_{+}$; $|R_d|=0$ is used
for a boundary extension. Ranks are positive natural numbers:
$r_i(d)\in\mathbb{N}_{+}$ is the one-based rank of $d$ under each
$i\in I_d$. Thus $I$ and $I_d$ are sets of integer indices, $|R_d|$ is a
nonnegative integer count, and every $r_i(d)$ is a positive natural
number.

All tunable parameters are real. The RRF rank-damping constant is
$k\in\mathbb{R}_{>0}$; $w_i\in\mathbb{R}_{\geq0}$ is retriever $i$'s fixed
weight; and the RBC persistence parameter is
$\phi\in[0,1)\subset\mathbb{R}$. The ISR-family offset is
$\sigma\in[0,1]\subset\mathbb{R}$. In the logarithmic RRF family,
$b\in\mathbb{R}_{\geq0}$ shifts coverage and
$B\in\mathbb{R}_{>0}$ scales the resulting score.
The rank kernel
$q_\phi:\mathbb{N}_{+}\to\mathbb{R}_{\geq0}$ and all eight scores are
real-valued and nonnegative on their stated domains.

$S_{\mathrm{RRF}}$, $S_{\mathrm{avg}}$, $S_w$,
$S_{\mathrm{RBC}}$, $S_{\mathrm{ISR}}$, $S_{\mathrm{logISR}}$,
$S_{\mathrm{logNISR}}$, and $S_{\mathrm{log}}$ are the document scores
produced by each rule.

### Plain RRF

The plain Reciprocal Rank Fusion kernel is

$$
S_{\mathrm{RRF}}(d) = \sum_{i \in I_d} \frac{1}{k + r_i(d)}.
$$

Cormack, Clarke, and Buettcher define the score as the sum of one
reciprocal-rank contribution from each ranking that contains the document
[@cormack2009]. A better rank means a smaller $r_i(d)$, which makes its
denominator smaller and increases that retriever's contribution. Moving from rank 2 to rank 1 matters more than
moving from rank 102 to 101 because the reciprocal curve is steepest
at the top of the ranking (lowest rank values).

Increasing $k$ lowers every contribution and compresses the contrast between
early and late ranks. When $k$ is large relative to the observed ranks, the
denominators are similar and rank position matters less; when $k$ is small,
top-ranked differences have greater leverage. Retriever coverage enters only through the
sum: every extra supporting retriever adds a positive term. A document with
several mediocre ranks can therefore overtake one with a single excellent
rank. Thus $k$ is a rank-damping constant, not a coverage normalizer: it does
not remove the reward for coverage.

### Coverage division

For $|R_d|\geq1$, coverage division is

$$
S_{\mathrm{avg}}(d) = \frac{S_{\mathrm{RRF}}(d)}{|R_d|}.
$$

This comparator takes the mean of the RRF reciprocal-rank contributions
[@cormack2009]. Ranks and $k$ change each term exactly as in RRF, but division
changes how another supporting retriever is interpreted. If its contribution
$x=1/(k+r)$ exceeds the current mean, it raises the score; if it is below the
mean, it lowers the score; and if it equals the mean, the score is unchanged.
Coverage is therefore not intrinsically beneficial: its effect depends on the
quality of the evidence being added.

At equal ranks, the score is invariant to $n$: every term is identical and
$S_{\mathrm{avg}}=1/(k+r)$ for every $n\geq1$. This invariance makes average
rank quality comparable across different coverages, but it also
erases the distinction between one retriever and many retrievers repeating the
same evidence. It removes the automatic reward for agreement and can discard
useful consensus evidence. Coverage division is useful when duplicate support
should not accumulate; it is undesirable when independent agreement is itself
evidence.

### Fixed retriever weights

The fixed-retriever-weight score is

$$
S_w(d) = \sum_{i \in I_d} \frac{w_i}{k + r_i(d)}.
$$

Azure AI Search documents positive weights for increasing or decreasing the
importance of vector-query results [@azureVectorWeighting]. Those supported
query weights are positive. The broader domain $w_i\geq0$ used here adds
$w_i=0$ only as a mathematical endpoint: it removes retriever $i$'s
contribution and is not a claim that Azure accepts a zero query weight.

The score is linear in each $w_i$. Doubling one weight doubles only that
retriever's contribution; improving its rank still raises that contribution;
and increasing $k$ still lowers and flattens it. Adding support with weight
$w_i>0$ raises the score, but the size of the increase depends on both the new
rank and the retriever's prior weight. Multiplying every weight by one positive
constant rescales every document equally and preserves their ordering.
Changing weights relative to one another can change the ordering by deciding
which retriever's evidence counts more. Fixed weights encode prior trust or
importance, not coverage normalization, because they do not adapt to
how many retrievers returned a particular document.

### Rank-Biased Centroid

Rank-Biased Centroid is

$$
S_{\mathrm{RBC}}(d; \phi) = \sum_{i \in I_d} q_\phi(r_i(d)),
$$

where the endpoint at $\phi=0$ is defined by continuous extension:

$$
q_\phi(r) =
\begin{cases}
(1-\phi)\phi^{r-1}, & 0 < \phi < 1, \\
1, & \phi = 0 \text{ and } r = 1, \\
0, & \phi = 0 \text{ and } r > 1.
\end{cases}
$$

The geometric kernel is Bailey et al.'s RBC formulation [@bailey2017]. At
$\phi=0$, only rank one contributes and no interpretation of $0^0$ is
required. For $0<\phi<1$, each one-rank descent multiplies a contribution by
$\phi$. Small $\phi$ concentrates nearly all mass at the head; larger $\phi$
makes decay slower and allows deep ranks to retain more of the preceding
rank's value.

Increasing $\phi$ nevertheless does not uniformly increase scores, because it
also reduces the rank-one mass $1-\phi$. For a fixed rank $r>1$, the term
$(1-\phi)\phi^{r-1}$ increases only until

$$
\phi=\frac{r-1}{r},
$$

and decreases thereafter; its response is not globally monotone. The parameter redistributes attention from the head
toward greater depth rather than acting as a score multiplier. RBC has no $k$:
$\phi$ replaces reciprocal damping with a geometrically interpretable depth
profile. Each additional supporting retriever still adds nonnegative mass, so
coverage can overcome rank weakness even though there is no explicit coverage
factor.

### ISR, logISR, and logN ISR

Mourao, Martins, and Magalhaes define an Inverse Square Rank family whose
shared rank sum is

$$
Q_{\mathrm{ISR}}(d)=\sum_{i\in I_d}\frac{1}{r_i(d)^2}.
$$

On $|R_d|\geq1$ and $\sigma\in[0,1]$, its three named scores are

$$
\begin{aligned}
S_{\mathrm{ISR}}(d) &= |R_d|Q_{\mathrm{ISR}}(d), \\
S_{\mathrm{logISR}}(d) &= \ln(|R_d|)Q_{\mathrm{ISR}}(d), \\
S_{\mathrm{logNISR}}(d;\sigma)
&= \ln(|R_d|+\sigma)Q_{\mathrm{ISR}}(d).
\end{aligned}
$$

These definitions and the tested offset range come directly from Mourao et al.
[@mourao2014]. The inverse square makes rank quality much more head-heavy than
RRF: moving from rank 1 to 2 divides a term by four, and moving from 1 to 10
divides it by one hundred. There is no $k$ to soften this decay. In every
variant, improving any supporting rank raises $Q_{\mathrm{ISR}}$ and therefore
raises the score whenever its coverage multiplier is positive.

ISR rewards coverage twice. Adding an equal-rank supporter both adds another
term to $Q_{\mathrm{ISR}}$ and increases the outer factor $n$. Consequently,
equal-rank support grows as $n^2/r^2$, more aggressively than RRF's $n/(k+r)$.
logISR replaces the linear outer factor with $\ln n$, so equal-rank support
grows as $n\ln n/r^2$. Its singleton boundary is severe: $\ln1=0$ erases all
rank evidence when $n=1$, so every singleton ties at zero regardless of rank.

logN ISR shifts that boundary. At $\sigma=0$ it is logISR. For
$\sigma>0$, a singleton receives the positive multiplier $\ln(1+\sigma)$, so
its inverse-square rank evidence survives. Raising $\sigma$ raises every
multiplier, but it proportionally favors low coverage: the relative separation
between adjacent coverage levels becomes less pronounced as the common shift
grows. Mourao et al. report using $\sigma=0.01$ to give singleton documents a
small nonzero weight, while $\sigma=1$ compressed the distinction between low
and high coverage [@mourao2014].

The ISR family isolates the design choice at issue here. Its coverage factors
can be transferred to RRF, but its inverse-square rank kernel cannot be called
RRF. The logarithmic RRF family below is the direct RRF-kernel analogue of
logN ISR: it retains the shifted logarithmic coverage factor while replacing
the inverse-square rank kernel with RRF.

### Logarithmic RRF family

For $b\geq0$, $B>0$, and returned documents with $|R_d|\geq1$, define the
logarithmic RRF score

$$
S_{\mathrm{log}}(d; b, B)
= B S_{\mathrm{RRF}}(d)\ln(|R_d| + b).
$$

This family combines Cormack, Clarke, and Buettcher's RRF kernel
[@cormack2009] with the shifted coverage factor used by Mourao et al.'s logN
ISR [@mourao2014]. The different kernel matters: RRF contributes
$1/(k+r)$ rather than $1/r^2$, so $k$ can control how quickly rank evidence
flattens.

A common global scale is supplied by $B$. Because it is positive and applies equally to
every document, it preserves every within-family order. It still matters when
the score is compared with a fixed threshold, combined with signals on other
scales, or required to satisfy a downstream calibration contract. Those uses
set the numerical score scale without changing what the family ranks first.

$b$ controls singleton weight, relative rewards between coverage levels, and
the marginal gain from one more supporting retriever. Holding
$S_{\mathrm{RRF}}$ fixed, the increment in its multiplier from coverage $n$
to $n+1$ is

$$
B\ln\left(\frac{n+1+b}{n+b}\right),
$$

which is positive and decreases with $n$: $\ln$ is increasing and concave, so
it has diminishing increments. In an actual ranking, a
newly supporting retriever also adds a positive term to
$S_{\mathrm{RRF}}$, so coverage raises both the RRF sum and the logarithmic
multiplier. Changing $b$ changes cross-coverage orderings rather than merely
rescaling every score. A small $b$ makes early coverage differences
comparatively strong; a large $b$ makes the multipliers for different finite
coverage levels more similar. Among documents with the same coverage and a
positive multiplier, the common factor preserves their RRF order. At
$b=0,|R_d|=1$, however, $\ln1=0$ erases every singleton rank and $k$
distinction.

For $b>0$, a useful subfamily normalizes the singleton multiplier to one by
choosing

$$
B=\frac{1}{\ln(1+b)}.
$$

Then a singleton receives exactly its plain RRF score, and $b$ controls only
the additional coverage reward beyond that baseline. This normalization is
undefined at $b=0$, precisely where the unnormalized family has the singleton
degeneracy. Setting $b=1$ gives $B=\frac{1}{\ln2}$ and the simple default

$$
S_1(d)=S_{\mathrm{RRF}}(d)\frac{\ln(|R_d|+1)}{\ln2}.
$$

The default has a finite logarithm at zero coverage, preserves every
singleton's RRF score, and gives additional agreement a concave reward without
introducing a freely tuned shift.

### Boundary and coverage analysis

The general family

$$
S_{\mathrm{log}}(d;b,B)
=B S_{\mathrm{RRF}}(d)\ln(|R_d|+b)
$$

allows $b\geq0$ on $|R_d|\geq1$. At $b=0$, the singleton multiplier is
zero, while the expression at $|R_d|=0$ is undefined. A finite zero-coverage
extension therefore requires $b>0$: $\ln(b)$ is finite and the empty RRF
sum makes the extended score zero. This extension supports boundary analysis;
it does not add an unreturned document to the scoring domain.

At that boundary, $0<b<1$ gives $\ln(b)<0$, $b=1$ gives $\ln(b)=0$,
and $b>1$ gives $\ln(b)>0$. These signs do not change the extended score
because its empty RRF factor is zero. As $b\to0$, the singleton multiplier
satisfies $\ln(1+b)\to0$; at $b=1$, it is $\ln2$ before singleton
normalization and one after multiplication by $B=1/\ln2$.

For fixed finite $I$, the large-shift limit is

$$
\frac{S_{\mathrm{log}}(d; b, B)}{B\ln b}
= S_{\mathrm{RRF}}(d)\frac{\ln(|R_d|+b)}{\ln b}
\longrightarrow S_{\mathrm{RRF}}(d)
\qquad (b \to \infty),
$$

uniformly over the fixed finite coverage range
$1\leq |R_d|\leq|I|$. With any fixed positive $B$, finite-$b$ ordering
therefore converges
to every strict, non-tied plain-RRF comparison. Documents tied by plain RRF can
still be differentiated by coverage at finite $b$. This fixed-range result
does not claim that $\ln$ is globally bounded.

For a clean coverage comparison, let each added retriever return the document
at the same rank $r$; for the weighted score also set each added $w_i=w$.
Plain RRF then grows as $n/(k+r)$, coverage division remains $1/(k+r)$,
fixed-weight RRF grows as $nw/(k+r)$, and RBC grows as
$nq_\phi(r)$. ISR grows as $n^2/r^2$, logISR as $n\ln n/r^2$, and logN ISR as
$n\ln(n+\sigma)/r^2$. The logarithmic RRF family grows as
$Bn\ln(n+b)/(k+r)$. Its logarithmic multiplier has diminishing increments,
but its product with the growing rank sum remains unbounded over this hypothetical
growing-retriever family. For fixed finite $I$, every score remains bounded
because $n\leq|I|$.

Table: Provenance and boundary behavior for the four scoring rules used in the worked example. {#tbl:scoring-rule-provenance}

| Method | Rank kernel | Formula | Nonzero at $|R_d|=1$ | Bounded coverage bonus | Source |
| --- | --- | --- | --- | --- | --- |
| $S_{\mathrm{RRF}}$ | reciprocal | $\sum_{i \in I_d} 1 / (60 + r_i(d))$ | Yes | No | RRF [@cormack2009] |
| $S_w$ | reciprocal | $\sum_{i \in I_d} w_i / (60 + r_i(d))$ | Yes | No | Azure weighted vector queries [@azureVectorWeighting] |
| $S_{\mathrm{ISR}}$ | inverse square | $|R_d|\sum_{i \in I_d} 1 / r_i(d)^2$ | Yes | No | ISR [@mourao2014] |
| $S_1$ | reciprocal | $S_{\mathrm{RRF}}\ln(|R_d| + 1) / \ln(2)$ | Yes | No | Singleton-normalized specialization |

### Comparisons

The main comparison asks what the default logarithmic RRF rule does when
several retrievers return the same candidate at different depths. Figure 1
uses a document with a single retriever scoring it at rank, as a common baseline.
A document with a single rank 100 score is weak, but agreement changes the result: two rank 100 scores already rank slightly higher than the sigle rank 1 document.
Three mixed occurrences at ranks $(100,500,1000)$ also narrowly beat the single
retriever rank one document. Logarithmic RRF therefore does more than preserve
evidence from several retrievers. It explicitly favors candidates corroborated
across retrievers, even when no single retriever places the candidate at the head
of its list.

Figure 2 explores the same rank profiles across the fusion methods.
For all graphs, the x axis is the ratio for each document's score relative to the
single retriever rank 1 score.  Panel (a) presents Figure 1 rescaled to this
logarithmic ratio. Panel (b) shows that Rank-Biased Centroid at $\phi=0.7$ is
effectively controlled by the shallowest rank: evidence at ranks 300--1000 adds
almost nothing to a rank-100 match, only somewhat mixing multiple retriever
mid-rank documents.  Panel (c) shows that ISR rewards additional retrievers, but its
inverse-square kernel still lets a rank-1 singleton dominate every mid-to-deep
profile shown. Panel (d) exposes logISR's singleton degeneracy: every singleton
receives score zero, so any candidate returned by two retrievers beats every candidate returned by
only one, regardless of the singleton's rank. Among multi-retriever candidates,
inverse-square rank quality again dominates.

Together the panels separate two choices that are easy to conflate. The rank
kernel decides how much evidence survives at depth; the coverage factor decides
how strongly independent retriever agreement changes the final order. At the
suggested $k=60$, $b=1$ defaults, logarithmic RRF is the only rule in this
comparison that both retains substantial mid-rank evidence and strongly
promotes cross-retriever agreement without erasing singletons.

```{=typst}
#pagebreak()
#set page(columns: 1)
```

```{=typst}
#import "../sections/03_diagram_examples/rank-profile-comparison.typ": rank-profile-comparison-figure
#import "../sections/03_diagram_examples/rank-profile-comparison-grid.typ": rank-profile-comparison-grid-figure
#counter(figure.where(kind: image)).update(0)
#figure(
  rank-profile-comparison-figure(),
  kind: image,
  supplement: [Figure],
  alt: "Horizontal bars compare seven logarithmic-RRF rank profiles with a candidate appearing once at rank 1. Profiles with one, two, three, and five supporting lists show how both support count and the individual ranks determine which candidate wins.",
  caption: [How to read logarithmic RRF at the suggested defaults $k=60$, $b=1$. Each row lists one candidate's ranks across distinct retrievers; bar length is its final score divided by the score of a candidate returned once at rank 1. The dashed line is the pairwise tie. Two rank-100 retrievers agree strongly enough to win, while the uneven pair $(100,500)$ loses. The mixed triple $(100,500,1000)$ barely wins, whereas three rank-100 occurrences and five broad mid-to-deep occurrences win decisively. Logarithmic RRF therefore strongly incentivizes agreement among retrievers. These are analytic score comparisons, not relevance judgments.],
)
#figure(
  rank-profile-comparison-grid-figure(),
  kind: image,
  supplement: [Figure],
  alt: "A compact two-by-two grid compares the same seven retriever-rank profiles under logarithmic RRF, Rank-Biased Centroid, ISR, and logISR. Every panel is a base-10 score ratio with a dashed tie line.",
  caption: [The Figure 1 rank profiles under four fusion rules. Panel (a) shows logarithmic RRF at $k=60$, $b=1$: mid-rank evidence survives, and agreement across retrievers can overcome a rank-1 singleton. Panel (b) shows Rank-Biased Centroid at $phi=0.7$: geometric decay makes the shallowest retriever dominate and renders deeper agreement negligible. Panel (c) shows ISR: coverage helps, but inverse-square decay leaves every displayed mid-to-deep profile below the rank-1 singleton. Panel (d) shows logISR: every singleton is erased by $ln 1=0$, so any multi-retriever result wins before rank quality distinguishes the remaining candidates. Panels (a)--(c) use a rank-1 singleton baseline; panel (d) uses ranks $(1,1)$.],
)
```

```{=typst}
#pagebreak()
#set page(columns: 2)
```
