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
make those representations interchangeable; it can only state how their
evidence should combine. Fixed weighting then exchanges C and F because the
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
head-rank evidence should dominate, although logISR's zero singleton score is
a strong boundary policy.

The logarithmic RRF family $S_{\mathrm{log}}$ grows as
$Bn\ln(n+b)/(k+r)$. Its singleton-normalized logRRF member $S_1$ retains RRF
at one supporter, but its unbounded multiplier keeps growing with coverage.
Saturated RRF ($S_{\mathrm{sat}}$) instead uses a bounded multiplier while retaining every
positive RRF term: an additional positive match always increases the score.
It therefore appears to fit a small retriever family where agreement should be
promoted but its extra multiplier should approach a declared ceiling.
Saturation moderates agreement promotion rather than removing it.

These comparisons count agreement among retrievers, not independent evidence.
Retriever outputs can be correlated because they share documents, training
data, representations, or query transformations.

### Next steps

The parameter examples are starting points, not an optimum. Evaluation would
need relevance judgments, a task-appropriate metric, and queries sampled from
the deployment corpus. A small parameter grid over $k$, $b$, $a$, and $t$ can
then be compared with untuned RRF, alongside a separate check of whether fixed
retriever weights remain stable across query types. Such an experiment would
measure retrieval quality; the analytic examples here only expose each rule's
mechanism.

## Conclusion

Reciprocal ranked fusion (RRF) allows normalizing several ranking retrievers without
needing their scores to be directly comparable. However, simple RRF does not
provide any mechnisms to control how each  retriever contributes to the overall
ranking. Prior techniques focused on manually weighting each retriever, or changing the
overall shape of the rankings. This paper proposes two families of functions that
allow finely tuning _concurrence_ between retrievers. Documents that are found by
a single retriever can be deemphasized in the final rankings, while documents that
are found by several retrievers can be promoted as their ranks have more agreement.

By exploring analytically and in simulations, we have identified several behaviors
that these families of functions contribute to the ranked fusion solution. Our future
work will refine these values against production data sets at scales of several rankers over hundreds of thousands of document chunks.