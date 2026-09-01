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
$q_\phi:\mathbb{N}_{+}\to\mathbb{R}_{\geq0}$ and all nine scores are
real-valued and nonnegative on their stated domains.

$S_{\mathrm{RRF}}$, $S_{\mathrm{avg}}$, $S_w$,
$S_{\mathrm{RBC}}$, $S_{\mathrm{ISR}}$, $S_{\mathrm{logISR}}$,
$S_{\mathrm{logNISR}}$, $S_{\mathrm{log}}$, and $S_{\mathrm{sat}}$ are the
document scores produced by each rule.

Coverage normalization makes its outer coverage policy explicit while retaining
the RRF rank kernel:

$$
S_C(d)=S_{\mathrm{RRF}}(d)C(R_d).
$$

The three policies below name their multipliers as $C_{\mathrm{inv}}$,
$C_{\mathrm{log}}$, and $C_{\mathrm{sat}}$. The score names remain useful
when referring to their complete scoring rules.

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
which retriever's contribution receives more weight. Fixed weights encode prior trust or
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

and decreases thereafter; its response is not globally monotone. The parameter
redistributes attention from the head
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
grows as $n\ln n/r^2$. Its one-retriever boundary is severe: $\ln1=0$ removes all
rank-dependent distinction when $n=1$, so every document returned by one retriever ties at zero regardless of rank.

logN ISR shifts that boundary. At $\sigma=0$ it is logISR. For
$\sigma>0$, a document returned by one retriever receives the positive multiplier $\ln(1+\sigma)$, so
its inverse-square contribution remains rank-dependent. Raising $\sigma$ raises every
multiplier, but it proportionally favors low coverage: the relative separation
between adjacent coverage levels becomes less pronounced as the common shift
grows. Mourao et al. report using $\sigma=0.01$ to give one-retriever documents a
small nonzero weight, while $\sigma=1$ compressed the distinction between low
and high coverage [@mourao2014].

The ISR family isolates the design choice at issue here. Its coverage factors
can be transferred to RRF, but its inverse-square rank kernel cannot be called
RRF. The logarithmic RRF family below is the direct RRF-kernel analogue of
logN ISR: it retains the shifted logarithmic coverage factor while replacing
the inverse-square rank kernel with RRF.

### Coverage normalization

Coverage normalization is the family of techniques introduced here for a
multiplier that changes how retriever coverage affects an RRF score:
$S_{\mathrm{technique}}(d)=S_{\mathrm{RRF}}(d) C_{\mathrm{technique}}(R_d)$.

Coverage division is the simplest coverage normalization: it removes the
automatic reward for repeated support by averaging rank contributions.

Define

$$
C_{\mathrm{inv}}(R_d)=\frac{1}{|R_d|},
$$

on returned documents with $|R_d|\geq1$. Its complete score is

$$
S_{\mathrm{avg}}(d) = S_{\mathrm{RRF}}(d)C_{\mathrm{inv}}(R_d).
$$

This comparator takes the mean of the RRF reciprocal-rank contributions.
The Division changes how additional supporting retrievers are interpreted.
With current coverage $n\geq1$, the score changes only according to whether
its contribution $x=1/(k+r)$ exceeds the current mean: it raises the score if
it does; if it is below the mean, it lowers the score; and if it equals the mean,
the score is unchanged.

Coverage is therefore not intrinsically beneficial: its effect depends on the
added reciprocal-rank contribution.

At equal ranks, the score is invariant to $n$: every term is identical and
$S_{\mathrm{avg}}=1/(k+r)$ for every $n\geq1$. This invariance makes average
rank quality comparable across different coverages, but it also
erases the distinction between one retriever and many retrievers returning the
document at the same rank. It removes the automatic reward for agreement.
Coverage division is useful when repeated retriever outputs should not
accumulate; it is undesirable when retriever agreement should affect the score.

It converts the RRF sum to the mean reciprocal-rank contribution among the
retrieval rankings that returned the document. Fox and Shaw's CombANZ similarly
averages a document's nonzero input scores, making it the closest prior
comparator for coverage division [@fox1994].

### Logarithmic RRF

Logarithmic normalization retains a positive reward for agreement while making
each successive multiplier increment smaller.

Define

$$
C_{\mathrm{log}}(R_d;b,B)=B\ln(|R_d|+b),
$$

for $b\geq0$, $B>0$, and returned documents with $|R_d|\geq1$. Therefore

$$
S_{\mathrm{log}}(d; b, B)=S_{\mathrm{RRF}}(d)C_{\mathrm{log}}(R_d;b,B).
$$

This family combines Cormack, Clarke, and Buettcher's RRF kernel
[@cormack2009] with the shifted coverage factor used by Mourao et al.'s logN
ISR [@mourao2014]. The different kernel matters: RRF contributes
$1/(k+r)$ rather than $1/r^2$, so $k$ controls how strongly the contribution
changes with rank.

A common global scale is supplied by $B$. Because it is positive and applies equally to
every document, it preserves every within-family order. It still matters when
the score is compared with a fixed threshold, combined with signals on other
scales, or required to satisfy a downstream calibration contract. Those uses
set the numerical score scale without changing what the family ranks first.

$b$ controls one-retriever weight, relative rewards between coverage levels, and
the marginal gain from one more supporting retriever. Holding
$S_{\mathrm{RRF}}$ fixed, the multiplier increment from coverage $n$ to
$n + 1$ is

$$
\delta_n=C_{\mathrm{log}}(n+1;b,B)-C_{\mathrm{log}}(n;b,B)
=B\ln\left(\frac{n+1+b}{n+b}\right),
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
$b=0,|R_d|=1$, however, $\ln1=0$ erases every one-retriever rank and $k$
distinction.

For $b>0$, a useful subfamily normalizes the one-retriever multiplier to one by
choosing

$$
B=\frac{1}{\ln(1+b)}.
$$

Then a document returned by one retriever receives exactly its plain RRF score, and $b$ controls only
the additional coverage reward beyond that baseline. This normalization is
undefined at $b=0$, precisely where the unnormalized family has the one-retriever
degeneracy. Setting $b=1$ gives $B=\frac{1}{\ln2}$ and the simple default

$$
S_1(d)=S_{\mathrm{RRF}}(d)\frac{\ln(|R_d|+1)}{\ln2}.
$$

The default has a finite logarithm at zero coverage, preserves every
one-retriever RRF score, and gives additional agreement a concave reward without
introducing a freely tuned shift.

### Saturating RRF

Saturating normalization can deemphasize single-retriever responses and place a
ceiling on the coverage multiplier. It is useful when agreement should matter
without its outer multiplier growing without bound.

For the small retriever families considered here, define

$$
C_{\mathrm{sat}}(R_d;a,b,t)=\operatorname{Sat}(|R_d|;a,b,t),
$$

where

$$
\operatorname{Sat}(n;a,b,t)=1+a(1-\exp((1+b-n)/t)).
$$

The complete score is

$$
S_{\mathrm{sat}}(d;a,b,t)=S_{\mathrm{RRF}}(d)C_{\mathrm{sat}}(R_d;a,b,t).
$$

Here the admissible parameters are restricted to $a>0$, $b\geq0$,
$t>0$, and

$$
a(e^{b/t}-1)<1,
$$

so every single retriever multiplier, and therefore every single retriever score, remains
positive.

The scale $a$ sets the asymptotic multiplier:
$\operatorname{Sat}(n)\to1+a$ as $n\to\infty$. This bounds the coverage bonus
above by 1 + a; the complete score is not globally bounded when the retriever
family itself is allowed to grow as $S_{\mathrm{RRF}}$ continues accumulating positive terms.

For a document returned by one retriever, $|R_d|=1$ and

$$
\operatorname{Sat}(1)=1-a(e^{b/t}-1).
$$

Thus for a document with a single retriever, $b=0$ preserves its RRF score, while 
$b>0$ applies increasing handicaps. At $b=t\ln(1+1/a)$ ($b=2\ln2$ for $a=1$ and $t=2$)
a single retriever becomes a liability to the final score. Increasing $b$ finds similar
for penalizing 2, 3, or more retrievers. The parameters $a$, $b$, and $t$ jointly set
the size of this one-retriever penalty and should be chosen against relevance judgments
rather than interpreted independently.

The multiplier increment from coverage $n$ to $n + 1$ is

$$
\begin{aligned}
\Delta_n
&=C_{\mathrm{sat}}(n+1;a,b,t)-C_{\mathrm{sat}}(n;a,b,t) \\
&=ae^{(b-n)/t}(e^{1/t}-1), \\
\frac{\Delta_{n+1}}{\Delta_n}
&=e^{-1/t}<1.
\end{aligned}
$$

Every increment is positive and successive increments diminish. Smaller $t$
front-loads the reward into the first few supporting retrievers; larger $t$
spreads the reward over more support. With $b>0$, increasing $t$ weakens the
single retriever handicap but lowers the multiplier $n\geq2$ retrievers.

This multiplier does not turn an added positive rank contribution into a score
decrease. If the current RRF sum is $R>0$ and an additional retriever contributes $x>0$, then, choosing
b such that a single retriever remains positive, both factors strictly increase:

$$
(R+x)\operatorname{Sat}(n+1)>R\operatorname{Sat}(n).
$$

For equal ranks $r$, the score becomes

$$
\frac{n}{k+r}\operatorname{Sat}(n;a,b,t).
$$

As in all RRF families, agreement among rankings does not establish retriever
independence. Correlated retrievers can share documents, training data,
representations, or query transformations.
For small retriever families, $a=1$ when $|R_d|=3$ and $a=2$ when $|R_d|>3$ are
reasonable corpus- and task-specific starting points. Use $b=0$ to preserve
single retriever scores, or make the small shift to $b=0.1$ when a slight
single retriever penalty is desired. These starting points use $t=2$; $a$,
$b$, and $t$ should be tuned against relevance judgments.

### Boundary and coverage analysis

The general logarithmic family

$$
S_{\mathrm{log}}(d;b,B)
=B S_{\mathrm{RRF}}(d)\ln(|R_d|+b)
$$

allows $b\geq0$ on $|R_d|\geq1$. At $b=0$, the one-retriever multiplier is
zero, while the expression at $|R_d|=0$ is undefined. A finite zero-coverage
extension therefore requires $b>0$: $\ln(b)$ is finite and the empty RRF
sum makes the extended score zero. This extension supports boundary analysis;
it does not add an unreturned document to the scoring domain.

At that boundary, $0<b<1$ gives $\ln(b)<0$, $b=1$ gives $\ln(b)=0$,
and $b>1$ gives $\ln(b)>0$. These signs do not change the extended score
because its empty RRF factor is zero. As $b\to0$, the one-retriever multiplier
satisfies $\ln(1+b)\to0$; at $b=1$, it is $\ln2$ before one-retriever
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
growing-retriever family. Saturated RRF instead grows as
$n\operatorname{Sat}(n;a,b,t)/(k+r)$, which is $O(n)$ because its multiplier
approaches $1+a$. For fixed finite $I$, every score remains bounded because
$n\leq|I|$.

The bounded multiplier does not give saturated RRF a rank-dominance guarantee.
To compare the two families directly, let $H$ be returned once at rank $1$ and
let $L$ be returned by $n$ retrievers, each at rank $r$. For either family,
$L$ outranks $H$ when

$$
\frac{n}{k+r}h(n)>\frac{1}{k+1}h(1),
$$

where $h(n)=C_{\mathrm{log}}(n;b,B)$ for logarithmic RRF and
$h(n)=C_{\mathrm{sat}}(n;a,b,t)$ for saturated RRF. For the logarithmic default
$S_log(d;1,B)$ this becomes

$$
r<n(k+1)\frac{\ln(n+1)}{\ln2}-k.
$$

At the saturated starting point $S_sat(d;1,02)$, it becomes

$$
r<n(k+1)\left(2-e^{-(n-1)/2}\right)-k.
$$

Both rules therefore permit several low-ranked retriever matches to overtake a
rank-one match. Logarithmic RRF becomes more coverage-aggressive as $n$ grows
because it retains the additional $\ln(n+1)$ factor; saturation moderates that
effect but cannot remove it while the underlying RRF sum remains additive.

The pathological cases are coverage-policy failures rather than arithmetic
errors. Correlated or duplicate retrievers can be counted separately despite
not being independent.
A large $k$ flattens the reciprocal-rank kernel, making shallow
and deep returned ranks more similar and allowing coverage to dominate sooner.
For logarithmic RRF, $b=0$ erases every single-retriever score, and as $b\to0^+$
the normalized ratio $\ln(n+b)/\ln(1+b)$ can strongly favor multi-retriever
documents. For saturated RRF, $b>0$ down-weights one-retriever documents; near
the positive-one-retriever boundary, its multiplier can approach zero even
though the multi-retriever multiplier remains bounded. Neither behavior proves
relevance, so dependent retrievers and parameter choices require empirical
evaluation.

```{=typst}
#pagebreak()
#set page(columns: 1)
```

```{=typst}
#import "../figures/scoring-rule-provenance-table.typ": scoring-rule-provenance-table
#scoring-rule-provenance-table() <tbl:scoring-rule-provenance>
```

Table: Illustrative saturated-multiplier settings for small retriever families. Values are $\operatorname{Sat}(n)$, not complete document scores. {#tbl:saturated-tuning}

| $a$ | $b$ | $t$ | Asymptote | $|R_d|=1$ | $|R_d|=2$ | $|R_d|=3$ | $|R_d|=4$ | $|R_d|=5$ |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 2 | 2 | 1.000 | 1.393 | 1.632 | 1.777 | 1.865 |
| 1 | 0.1 | 2 | 2 | 0.949 | 1.362 | 1.613 | 1.765 | 1.858 |
| 2 | 0 | 2 | 3 | 1.000 | 1.787 | 2.264 | 2.554 | 2.729 |

```{=typst}
#import "../sections/03_diagram_examples/coverage-multiplier-curves.typ": coverage-multiplier-curves-figure
#figure(
  coverage-multiplier-curves-figure(),
  kind: "coverage-policy",
  supplement: [Coverage plot],
  alt: "Nine coverage multiplier curves compare black coverage division, two dotted red logarithmic settings, and six saturated settings. Dashed blue curves vary a and t at b equals zero, while solid green curves vary b at a equals two and t equals two. The vertical axis begins at zero; plotted coverage begins at one.",
  caption: [Coverage multipliers for $|R_d|=1$ through $7$, with the vertical axis beginning at zero and the plotted coverage beginning at one. The black curve is coverage division, $C_"inv"(n)=1/n$. Dotted red curves are logarithmic RRF, normalized at one retriever, for $b=1$ and $b=2$; they remain unbounded. Dashed blue curves show saturated RRF with $b=0$ as $a$ and $t$ vary. Solid green curves hold $a=2$ and $t=2$ while varying $b$, exposing the one-retriever penalty. Saturated curves approach $1+a$.],
)
```

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
  alt: "Touching equal-height red logRRF and blue saturated-RRF bars compare seven rank profiles. Clear vertical whitespace separates profile pairs; the ColorBrewer Set1 colors remain distinguishable when printed in black and white.",
  caption: [LogRRF at $k=60$, $b=1$ beside $S_"sat"(d;3,0.1,2)$. Each touching pair is one candidate's ranks across distinct retrievers, normalized to that method's rank-1 singleton; whitespace separates cases. The positive $b$ slightly penalizes singleton coverage, while the saturation multiplier is bounded and approaches four. These are analytic score comparisons, not relevance judgments.],
)
#figure(
  rank-profile-comparison-grid-figure(),
  kind: image,
  supplement: [Figure],
  alt: "Five distinct small-multiple panels compare logRRF, RBC, ISR, logISR, and saturated RRF across the same seven rank profiles. logISR uses its distinct two-rank-one baseline.",
  caption: [The Figure 1 profiles in five panels, one for each fusion rule: logRRF, RBC, ISR, logISR, and $S_"sat"(d;3,0.1,2)$. Panel (e) adds saturated RRF to the four original rule-family panels. Bars encode base-10 score ratios; logISR is normalized to $(1,1)$ because its singleton score is zero, while the other rules use $(1)$. The figure compares scoring behavior, not retrieval effectiveness.],
)
```

```{=typst}
#pagebreak()
#set page(columns: 2)
```
