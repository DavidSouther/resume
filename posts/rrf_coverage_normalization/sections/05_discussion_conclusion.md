## Discussion

Rank fusion is not only a choice of rank kernel. It is also a policy for how
coverage $|R_d|$ interacts with the observed ranks $r_i(d)$. The constants $k$
and $b$ shape rank depth and the treatment of low coverage; for saturated RRF,
$a$ sets the agreement ceiling and $t$ controls how quickly that ceiling is
approached. None can be chosen sensibly without the corpus and retrieval task.

### What the worked example separates

The illustrative fixture includes results at $|R_d|=1$, $|R_d|=2$, and
$|R_d|=3$. From the same rank table, $S_{\mathrm{RRF}}$ orders the documents
D > A > E > F > C > B > G, while $S_w$ gives D > A > E > C > F > B > G.
$S_{\mathrm{ISR}}$ produces D > F > B = C > A > E > G, and both $S_1$ and
$S_{\mathrm{sat}}$ produce D > A > E > F > C > B > G at the displayed
settings. The ISR equality is exact:
$S_{\mathrm{ISR}}(B)=S_{\mathrm{ISR}}(C)=1$.

The input rankings already contain a reversal. The text embedding ranks D
ahead of F, while the multimodal embedding ranks F ahead of D. Fusion cannot
make those representations interchangeable; it can only combine their ranked
outputs. Fixed weighting then exchanges C and F because the
plain-RRF margin between them is less than $10^{-5}$ and the lexical channel
has the largest declared weight. Documents A through G are all visible here,
but the construction is illustrative, not a benchmark.

### Why the A and B pair reverses

The local judgment is A above B. A appears at rank 4 in all three retrievers;
B appears at rank 1 in only one. At $k=60$, RRF's damped reciprocal terms let
three moderate contributions exceed the one head contribution. ISR's
inverse-square kernel makes rank 1 much more dominant, so ISR reverses that
pair. This judgment explains which behavior is wanted in the example; it is
not a relevance label for a broader corpus.

### Where each rule appears to fit

The equal-rank growth rates make the policy differences explicit. Plain
$S_{\mathrm{RRF}}$ grows as $n/(k+r)$ and can fit settings where every returned
list contributes the same kind of vote. $S_{\mathrm{avg}}$ remains
$1/(k+r)$ and appears to fit cases where coverage should not itself add a
reward. Fixed $S_w$ grows as $nw/(k+r)$ and can encode known differences in
retriever value. Analytically, $S_{\mathrm{RBC}}$ grows as $nq_\phi(r)$ and is
likely to fit tasks where deep ranks should vanish rapidly.

The inverse-square families make rank position sharper. $S_{\mathrm{ISR}}$
grows as $n^2/r^2$, $S_{\mathrm{logISR}}$ as $n\ln n/r^2$, and
$S_{\mathrm{logNISR}}$ as $n\ln(n+\sigma)/r^2$. They can suit tasks where
head-rank contributions should dominate, although logISR's zero singleton score is
a strong boundary policy.

The logarithmic RRF family uses $C_{\mathrm{log}}(R_d;b,B)$; at equal ranks,
its complete score grows as $Bn\ln(n+b)/(k+r)$. Its singleton-normalized logRRF
member $S_1$ retains RRF at one supporter, but its unbounded multiplier keeps
growing with coverage. Saturated RRF ($S_{\mathrm{sat}}$) instead uses the
bounded multiplier $C_{\mathrm{sat}}(R_d;a,b,t)$ while retaining every
positive RRF term: an additional positive match always increases the score.
It therefore appears to fit a small retriever family where agreement should be
promoted but its extra multiplier should approach a declared ceiling.
Saturation moderates agreement promotion rather than removing it.

These comparisons count agreement among retrievers; they do not establish that
the retrievers are independent. Outputs can be correlated because retrievers
share documents, training data, representations, or query transformations.

### Next steps

The parameter examples are starting points, not an optimum. Evaluation would
need relevance judgments, a task-appropriate metric, and queries sampled from
the deployment corpus. A small parameter grid over $k$, $b$, $a$, and $t$ can
then be compared with untuned RRF, alongside a separate check of whether fixed
retriever weights remain stable across query types. Such an experiment would
measure retrieval quality; the analytic examples here only expose each rule's
mechanism.

## Conclusion

Reciprocal Rank Fusion (RRF) combines several ranked retriever outputs without
requiring their score scales to be comparable. Plain RRF sums the returned
reciprocal-rank contributions. Fixed weights change the influence of individual
retrievers, while other methods change the rank kernel. The coverage
normalizations keep the RRF kernel and instead control how
retriever coverage changes the final score.

The analysis and simulations show how logarithmic and saturating multipliers
change the treatment of singleton returns and agreement among retrievers. Their
parameters require evaluation against relevance judgments on the intended
corpus and task; the illustrative fixture does not select an optimum.
