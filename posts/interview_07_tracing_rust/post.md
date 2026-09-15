---
title: "Tracing Rust: Ownership, Borrows, and Lifetimes on Paper"
summary: "Three untested candidate notations extend the pen-and-paper T-table from the tracing series to cover Rust ownership, move, copy, borrow, mutable borrow, drop, and lifetime extent, compared against the same seven listings and a fixed acceptance criterion."
show: false
---

# Tracing Rust: Ownership, Borrows, and Lifetimes on Paper

This is part four of the series that started with [Tracing Algorithms](/blog/interview_03_tracing). That post built a name/value T-table for tracing JavaScript and Java by hand: cross out a value on overwrite, draw a horizontal frame line for each function call, add a return row with a left-margin arrow, keep a watch row for an intermediate expression, and drop a dashed line around a block scope. None of that goes away here.

Rust adds a question the T-table has no column for: who owns a value, who may touch it, and for how long. This post stages that question onto the existing table in four steps — baseline recreation, then move/copy, then borrows, then lifetime extent and the errors it explains — and develops three candidate notations far enough to draw the same seven listings with each. The candidates are compared at the end, with a recommendation.

**This material has not been tested with learners.** Every candidate is a proposal, not a validated method. The comparison ends with a protocol for running that test later; none of it has been run yet.

## The four verbs, corrected

The prompt that started this post sketched a four-row table: Move, Copy, Borrow, and (folded into Borrow) Mutable Borrow. Reading it against actual Rust semantics turned up three defects, corrected here.

The table reads with three answers, not two: after a `<verb>`, the `<noun>` of `var_b` is `<the same as / new from / a reference to>` `var_a`'s.

| `let var_b = var_a;` | Data address | Type | Owner of the data | Value in `var_b` | Access |
|---|---|---|---|---|---|
| Move | Same | Same | New — `var_b` | Same bytes | `var_a` none; `var_b` full |
| Copy | New | Same | Same — each binding owns its own | Equal bytes | Both full, independent |
| Borrow | Same | New — `&T` | Same — `var_a` | A reference to `var_a` | `var_a` read only (❄); `var_b` read |
| Mutable borrow | Same | New — `&mut T` | Same — `var_a` | A reference to `var_a` | `var_a` none for the span (🔒); `var_b` read and write |

1. **Location is split, and one half is dropped.** The sketch used one Location column two ways: the data's address for Move and Copy, the binding's stack slot for Borrow. This table fixes the column to mean the address of the data the binding designates. The binding's own stack slot is not a column at all, because every `let` makes a new slot — that answer is always New, and a column that never changes teaches nothing.
2. **Owner means the owner of the data, and the prose wins over the sketch.** The sketch had `Owner: New` for Borrow, which was reading the binding's slot, not the data's ownership. A borrow leaves the owner unchanged. The corrected table reads Owner as `var_a` for both borrow rows.
3. **Mutable borrow earns its own row, and Access is why.** Under the original four columns, Mutable Borrow differed from Borrow only in Type, which is why the sketch could fold it in. The Access column carries the real difference — who may read and who may write during the span — and it is the column that separates all four verbs from one another.

The rest of this post stages these four verbs, plus drop and lifetime extent, onto the T-table three different ways: [Stage 0's baseline](/blog/interview_07_tracing_rust/candidates/00-baseline), [Candidate A's extended table](/blog/interview_07_tracing_rust/candidates/01-t-table), [Candidate B's lifeline graph](/blog/interview_07_tracing_rust/candidates/02-lifeline), [Candidate C's hybrid](/blog/interview_07_tracing_rust/candidates/03-hybrid), and a [comparison](/blog/interview_07_tracing_rust/candidates/comparison) that recommends one.
