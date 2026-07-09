## 1. Introduction

Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts.
Prompting fixes a start point.
Large language models generate tokens to move along a manifold defined by the learned structrure from its training set.
A retrieved document, compiler error, or tool observation changes the next move.
A subagent fan-out explores several nearby starts.
Tree search keeps several partial trajectories alive and backtracks when a value signal says one is worse.
Read as if generation were moving through a document region, these are not an unrelated grab-bag of agent tricks.
They are comparable steering operators with different impulses, signals, referent-validation paths, costs, and failure modes.

This is therefore a **synthesis and position paper**, not a new formalism.
It borrows geometric vocabulary — manifold, trajectory, region, basin — from published prior art (Section 2), and none of that vocabulary is introduced here for the first time.
The contribution is the **workflow-level reading**: a diagnostic vocabulary that turns familiar agentic techniques into steering operators with seven falsifiable conditions for when each technique should help, fail, or become too expensive (Section 6), grounded in seven worked analyses (Section 5) and a reusable operator table (Section 4).

**What this paper is not claiming.**
It is not a new theorem, a new categorical formalism, or a claim that treating LLMs as manifolds is itself novel — Section 2 draws that boundary against the closest prior art explicitly.
It does not claim a metric on document space, a proven basin-of-attraction structure for a single forward pass, or that "document space" is one smooth surface rather than a union of task-local regions (Section 3's caveats).
Two extensions the author has explored elsewhere are deliberately out of scope here: an endofunctor fixed-point formalism for iterated generation [@souther2024], and an empirical bridge between the loss-landscape geometry of training and the document-space geometry of generation.
Both would require engaging the closest prior art (Section 2) far more formally than a position paper's evidence standard supports, and are left as future work.

**Roadmap.**
Section 2 keeps the literature review in front, because novelty honesty is what lets the operator analogy survive.
Section 3 introduces only the geometry the rest of the paper needs.
Sections 4 and 5 are the paper's load-bearing contribution: the operator table and seven worked analyses.
Section 6 generalizes those analyses into seven falsifiable predictive conditions, and Section 7 compares this reading against the alternative frames a reviewer would reasonably reach for.
Section 8 is this paper's evaluation: a claim ledger and a two-part readiness gate.
Section 9 closes with a reusable checklist for reading an agent workflow through this lens.
