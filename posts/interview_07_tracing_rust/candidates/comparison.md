# Comparison

Five candidates were drawn against the same seven listings, starting from the
same Stage 0 baseline. This document compares them on the draw-order
criterion and recommends one.

## Stage 0 recap

All five candidates start from the same recreation of the existing
repertoire: name/value T-table, cross-out on overwrite, heap arrows, frame
lines, the return row and arrow, watch rows, and dashed block scope. None of
the five candidates changes a Stage 0 mark. They differ only in what they add
on top of it.

## The governing rule

The Ithaca Memory Diagram papers state the rule this comparison is judged
against: **add detail rather than change earlier notation.** A candidate that
must rewrite or erase a mark the reader already drew has broken the rule, no
matter how expressive the result is.

## Draw-order comparison

The acceptance criterion from the design is that a candidate must be drawable
top-to-bottom, one statement at a time, with no back-editing of an earlier
mark and no drop diamond reserved in advance. Each candidate's own
`Draw order` section reports its result honestly; this section restates those
findings side by side.

**Candidate A — extended T-table.** Stays inside the table by adding one
narrow own-column strip per binding. Moves and scope exits are appended, and
the drop dagger is written only when destruction is reached. Precise
non-lexical borrow ends still require lookahead or later annotation. Its other
cost is that lifetime extent is two statement stamps a reader compares
(`O@s1 … †@s6`), not a length a reader sees.

**Candidate B — Mermaid node graph.** Replaces the table with a generated
flowchart of simple nodes and edges, which departs from the governing rule but
removes manual column planning. State transitions are explicit, and a dashed
attempted edge leads to a labelled rejection node instead of inventing a
runtime state. Nodes can be added one statement at a time, including end
diamonds only when scope exit is reached. Precise non-lexical loan endings
still require looking ahead to find a reference's last use; the honest
teaching alternative is to extend the loan conservatively to lexical scope
exit.

**Candidate C — hybrid.** The table body is untouched; new marks land in a
margin ruler instead of rewriting the table. Moves, accepted transfers,
temporary call borrows, and scope exits are decided when their rows are
reached. Precise non-lexical borrow ends are not: a reader cannot know a use
is the last use without looking ahead. As with Candidate B, the honest choices
are to annotate the end after reading later code or extend the borrow
conservatively to lexical scope exit. Its other cost is margin width for many
simultaneous live bindings.

**Candidate D — gutter highlighter.** Removes the glyph alphabet and draws one
literal band from each binding or borrow to its lexical closing brace. The
source's `&` or `&mut` supplies access kind; geometry supplies overlap. Its
draw order is completely mechanical, and legal shared overlap versus separated
mutable overlap is immediate. The price is deliberate conservatism: the bands
overstate Rust's non-lexical active loans, so the notation teaches a lexical
subset and can flag some Rust-accepted programs as conflicts. It also cannot
show use after move from scope geometry alone.

**Candidate CD — combined ruler and memory trace.** Uses D's differently
colored lexical bands, with adjacency and endpoints carrying ownership and
reference transitions, then places the Tracing Algorithms memory/frame table
beside them. It keeps D's mechanical scope drawing while restoring the
ownership facts that diagnose use after move and the frame/value facts that
explain a rejected returned local reference.

## Recommendation

Candidate CD is now the recommendation to test first as a complete ownership
trace. It preserves Candidate D's literal highlighting instruction, uses
touching bands and visible endpoints to show derived references and moves, and
restores the familiar Tracing Algorithms memory view when a frame or
destruction site matters. C and D remain valuable isolated experiments: their
separation makes it possible to
test which layer supplies a learner's answer. Candidate B makes state changes
and rejected attempts clear in generated layout, but it discards the familiar
table and precise non-lexical loan endings require lookahead. The
recommendation remains a testable hypothesis, not a claim that CD has already
proven effective.

## What to test

None of this material has been tested with learners. The stated success
measure, from the design's user journey, is whether a reader who has never
learned Rust ownership can, after working through the hybrid or gutter
highlighter candidate, look at each of the seven listings on paper and predict
which compile and which do not, pointing at the trace evidence that decides
it, before reading the compiler's error.

## Test protocol

A later study should recruit readers who already know the T-table (for
example, from `interview_03_tracing`) but have no prior Rust ownership
knowledge. Assign each reader C, D, or the combined CD view. Then give each reader the
seven fixed listings — 2.2, 2.5, 2.9, 2.11, 2.12, 2.13, and
the Copy listing — in an order that mixes compiling and non-compiling
programs, without being told which is which. For each listing, the reader
draws the trace by hand, states whether the program compiles, and, for the
non-compiling listings, points at the mark that decides it. The protocol
records: time to draw each trace, whether the compile/no-compile prediction
is correct, whether the reader ever erases or rewrites an existing mark
(a direct check of the no-back-editing criterion), and whether the reader
runs out of margin width. This comparison and its recommendation are
untested opinions until that protocol, or one like it, is run.
