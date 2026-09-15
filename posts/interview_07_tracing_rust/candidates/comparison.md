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
narrow own-column strip per binding. It satisfies no-back-editing: every glyph
is appended, and the drop dagger is written only at scope exit. The recorded
cost is in the strip itself, not in the draw order — the lifetime extent is
two statement stamps a reader compares (`O@s1 … †@s6`), not a length a reader
sees. That is a readability tradeoff inside an otherwise clean incremental
draw order.

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

**Candidate C — hybrid.** The table body is untouched, so it cannot violate
the governing rule on the body at all; every new mark lands in a blank margin
ruler instead of on ink that already exists. Its `Draw order` section shows
every glyph decided by the current statement alone — `o` from a `let`, `D` or
`>` from a visible `&` or `&mut`, `*` from a by-value parameter type, `#` from
a closing brace — with no drop diamond reserved before its scope exit and no
borrow-span foreknowledge required, because a borrow's open and close are each
written from what is visible on the line being drawn. The one cost it names is
margin width for many simultaneous live bindings, which is a layout cost paid
in the margin, not a back-editing cost paid against the table.

## Recommendation

Candidate C, the hybrid, is the recommendation. It is the only one of the
three that both extends the table, rather than replacing it, and satisfies
the incremental draw-order criterion without needing foreknowledge of a drop
point or a borrow's end. Candidate A satisfies draw order too, but pays for it
with a lifetime extent the reader must compare rather than see. Candidate B
draws lifetime extent most clearly of the three but violates the governing
rule twice over: it discards the table, and its own draw order admits it
sometimes cannot avoid foreknowledge.

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
