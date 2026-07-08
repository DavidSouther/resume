## 1. Introduction

This paper's thesis fits in one sentence: an agentic LLM workflow can be
read **as if** it were a sequence of operators steering a document through a
region of syntactic space toward a target region of acceptable artifacts for
a given task. Prompting fixes a start point; a retrieved document or a
compiler's error message pulls the trajectory toward or away from that
target; a subagent fan-out explores several regions at once; a tree search
does the same with backtracking. Read this way, prompt changes, retrieval,
retries, execution feedback, thinking tokens, subagents, and tree search
stop looking like an unrelated grab-bag of tricks and become comparable
moves, each with a different signal, a different cost, and a different way
to fail.

This is a **synthesis and position paper**, not a new formalism. It borrows
its geometric vocabulary — manifold, trajectory, region, basin — from
published prior art (Section 2), and none of that vocabulary is introduced
here for the first time. What this paper contributes is the
**workflow-level reading**: a lens that turns a list of known agentic
techniques into a single diagnostic vocabulary with seven falsifiable
conditions for when each technique should help, fail, or become too
expensive (Section 6), grounded in six worked examples (Section 5) and a
reusable operator table (Section 4).

**What this paper is not claiming.** It is not a new theorem, a new
categorical formalism, or a claim that treating LLMs as manifolds is itself
novel — Section 2 draws that boundary against the closest prior art
explicitly. It does not claim a metric on document space, a proven
basin-of-attraction structure for a single forward pass, or that "document
space" is one smooth surface rather than a union of task-local regions
(Section 3's caveats). Two extensions the author has explored elsewhere are
deliberately out of scope here: an endofunctor fixed-point formalism for
iterated generation [@souther2024], and an empirical bridge between the
loss-landscape geometry of training and the document-space geometry of
generation. Both would require engaging the closest prior art (Section 2)
far more formally than a position paper's evidence standard supports, and
are left as future work.

**Roadmap.** Section 2 states what is already formalized and draws the
novelty boundary. Section 3 introduces only the geometry the rest of the
paper needs. Sections 4 and 5 are the paper's load-bearing contribution: the
operator table and six worked analyses. Section 6 generalizes those
analyses into seven falsifiable predictive conditions, and Section 7
compares this reading against the alternative frames a reviewer would
reasonably reach for. Section 8 is this paper's evaluation: a claim ledger
and a two-part readiness gate. Section 9 closes with a reusable checklist
for reading an agent workflow through this lens.
