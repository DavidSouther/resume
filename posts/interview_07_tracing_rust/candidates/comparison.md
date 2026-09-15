# Comparison

Three candidates were drawn against the same seven listings, starting from the
same Stage 0 baseline. This document compares them on the draw-order
criterion and recommends one.

## Stage 0 recap

All three candidates start from the same recreation of the existing
repertoire: name/value T-table, cross-out on overwrite, heap arrows, frame
lines, the return row and arrow, watch rows, and dashed block scope. None of
the three candidates changes a Stage 0 mark. They differ only in what they add
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

**Candidate B — lifeline graph.** The most expressive candidate on lifetime
extent, and the one that discards the table entirely, which is exactly what
the governing rule forbids. Its own `Draw order` section is honest about two
places it needs foreknowledge: the horizontal budget (a lifeline graph grows
sideways, so the reader must know in advance how many bindings and nested
frames a program will produce before placing the first column, or the page
runs out of width and the whole drawing restarts) and the end of a named
borrow span (`let r = &mut x;` closes only at the reference's last use,
further down a page the reader has not read yet, forcing either an
over-conservative dashed span or a back-edit once the last use is known).
Drop diamonds alone stay incremental; page layout and named borrow spans do
not.

**Candidate C — hybrid.** The table body is untouched; new marks land in a
margin ruler instead of rewriting the table. Moves, accepted transfers,
temporary call borrows, and scope exits are decided when their rows are
reached. Precise non-lexical borrow ends are not: a reader cannot know a use
is the last use without looking ahead. As with Candidate B, the honest choices
are to annotate the end after reading later code or extend the borrow
conservatively to lexical scope exit. Its other cost is margin width for many
simultaneous live bindings.

## Recommendation

Candidate C, the hybrid, is the recommendation to test first. It extends the
table rather than replacing it, makes ownership transfer spatially visible,
and keeps ordinary moves and scope exits incremental. It does **not** solve
the last-use problem: exact non-lexical borrow ends require lookahead or later
annotation in all three candidates. Candidate A keeps the table too, but its
lifetime extent is a pair of labels rather than a visible length. Candidate B
draws lifetime extent most clearly but discards the familiar table and needs
the most horizontal planning. The recommendation is therefore a testable
hypothesis, not a claim that Candidate C meets every criterion uniquely.

## What to test

None of this material has been tested with learners. The stated success
measure, from the design's user journey, is whether a reader who has never
learned Rust ownership can, after working through the hybrid candidate, look
at each of the seven listings on paper and predict which compile and which do
not, pointing at the mark that decides it, before reading the compiler's
error.

## Test protocol

A later study should recruit readers who already know the T-table (for
example, from `interview_03_tracing`) but have no prior Rust ownership
knowledge. Each reader works through the hybrid candidate's staged material,
then is given the seven fixed listings — 2.2, 2.5, 2.9, 2.11, 2.12, 2.13, and
the Copy listing — in an order that mixes compiling and non-compiling
programs, without being told which is which. For each listing, the reader
draws the trace by hand, states whether the program compiles, and, for the
non-compiling listings, points at the mark that decides it. The protocol
records: time to draw each trace, whether the compile/no-compile prediction
is correct, whether the reader ever erases or rewrites an existing mark
(a direct check of the no-back-editing criterion), and whether the reader
runs out of margin width. This comparison and its recommendation are
untested opinions until that protocol, or one like it, is run.
