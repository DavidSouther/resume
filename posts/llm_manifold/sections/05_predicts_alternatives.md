## 6. What This Lens Predicts

A framing that cannot fail is not doing any work. This section states seven
conditions under which a steering operator should help, fail, or become too
expensive to justify. Each condition names a way its operator can *reverse*
from helpful to useless or harmful — a claim a flat "more prompting helps"
account has no separate way to make — and each is already exercised by one of
the worked analyses in Section 5.

**Target observability.** Re-coupling the trajectory to a referent only works
if that referent is actually observable: a compiler verdict, a passing test,
a visible panel. Where the target is unobservable, or only partly surfaced —
a "created" claim against a tool that silently no-ops — the lens predicts
decoupling. Section 5.1's false-completion case is this condition failing in
production.

**Feedback reliability.** The signal returned has to be trustworthy, not
merely present. An external, verifiable signal (a runtime, a test suite) is a
different thing from a model's own noisy self-critique. Where the "verifier"
is itself model-generated with no ground truth, the lens predicts the move
degrades to intrinsic self-correction and the improvement shrinks or
reverses — Section 5.2's compiler-repair case, read against the
external-vs-intrinsic split.

**Search breadth.** Sampling, subagent, and tree-search operators help only
when there are genuinely many distinct viable paths to explore. Where the
branches share a start point and conditioning, breadth is illusory — Section
5.5's shared-prompt-bias collapse.

**Artifact inspectability.** Manufacturing a stand-in point helps only when
that stand-in exposes something checkable — a real, retrievable document
nearby — rather than being consumed as its own answer. Where the target
neighborhood is genuinely empty, the lens predicts the stand-in gets treated
as fact instead of scaffolding — Section 5.4's fabrication-on-empty-search
finding.

**Serial dependency.** Chain-of-thought and pause-token operators help only
when the task is actually bottlenecked by sequential computation, not by
breadth or observability. On a task that is not serially bottlenecked, the
lens predicts a flat return on extra thinking tokens — Section 5.3.

**Cost.** Search-based operators trade compute for a chance at a better
trajectory. The lens predicts this trade only pays off when the verifier
guiding the search is both cheap and sound; when it is expensive, unsound, or
merely a proxy, added breadth is a pure loss rather than a diminishing
return — Section 5.6's tree-search cost-explosion case.

**Collapse onto shared prompt/context bias.** Branching operators whose
branches share a start point do not expand the region actually explored. The
lens predicts near-zero marginal return from adding more samples under one
shared conditioning, and a return to genuine gains only when branches have
distinct start points — different bindings, providers, or roles — restoring
the search-breadth condition above rather than merely restating it.

Read together, these seven conditions are what separates a lens with
predictive leverage from a rebranding of already-known techniques: each names
an axis along which the same operator, examined more closely, should help in
one regime and hurt in another. A prompt-engineering account of any single
worked analysis in Section 5 can describe that one trace; it has no way to
state, in advance, the condition under which the same technique would have
failed instead.

## 7. Alternative Views and Limitations

The steering-operator reading is one lens among several standing accounts of
the same phenomena, offered as a complementary diagnostic vocabulary rather
than a replacement for any of them.

**Program synthesis.** Agent workflows that generate and repair code are
already studied as search over program space, with a many-to-one map from
programs to the functions they implement (Section 3 borrows exactly this
framing). Program synthesis gives a mature account of *what* is being
searched; the steering-operator lens adds an account of *how* an agentic
workflow's specific moves — prompting, retrieval, execution feedback —
reposition that search over time. The two are compatible descriptions at
different grain sizes, not competitors.

**MDP / control.** An agent workflow can equally be modeled as a policy
choosing actions to maximize an objective, with tool calls as actions and
observations as state transitions — and for ReAct and LATS in particular, the
underlying mechanics genuinely are search and control procedures. The
steering-operator lens is a representation-space complement to that account:
it describes what happens to the *document* the policy produces, not a
replacement for the control-theoretic description of the policy itself.

**Information geometry / statistical manifold.** The mathematical apparatus
for treating a model's internal representations as a manifold, with a
rigorous metric or curvature structure, already exists and is more precise
than anything this paper introduces. This paper borrows the vocabulary, not
the formalism, and defers any metric or curvature claim to that literature —
the caveat carried throughout Section 3.

**Category theory.** Bradley, Terilla, and Vlassopoulos's `[0,1]`-enriched
category of texts already formalizes a compositional, probability-weighted
structure over language, and is the closest prior art to this paper's
picture (Section 2). This paper does not extend that formalism; its claim
sits at the workflow-diagnostic level, which that formalism does not itself
address.

**"Just prompt engineering."** Section 6 is this paper's answer. If steering
operators were merely a rebranding of prompting, none of that section's seven
conditions would be falsifiable, because there would be nothing for a
condition to reverse against. Each names a way an operator flips from helpful
to useless or harmful, which a flat "more prompting helps" account cannot
state.

**Limitations and submission fit.** This is a synthesis/position paper, not
a paper reporting a new theorem, dataset, or benchmark result of its own;
main-track NeurIPS/ICML/ICLR fit is correspondingly weaker, and a position
track, workshop, TMLR/JAIR-style venue, or arXiv-first circulation is a
better match unless a later project adds a genuine empirical or theoretical
result. The mathematical vocabulary here is organizing language, not proof:
every geometric or categorical term not grounded in a cited theorem is
marked as author analogy in the claim ledger (Section 8). The Section 5.1
case, this paper's sharpest evidence, comes from hand-picked traces rather
than a random sample; the lens's usefulness beyond that one case still has to
survive a Lit Group transfer test on a workflow it has not seen (Section 8).
And not every agentic improvement is "steering" in the same sense — Table 1's
own prompting row never touches a referent at all — so treating every
operator as one mechanism risks flattening real differences the alternative
views above take more seriously.
