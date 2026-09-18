# Intent Review — design.md (2026-09-18)

Anchor: `research.md` "Topic and Intent" verbatim quote. No `.ailly/prompts/` file
exists for this session.
Dispatch: cold. A freshly dispatched reviewer read `design.md`, `research.md`, and
`reviews/2026-09-18-research-intent-review.md` with no access to the session's
reasoning trail.

Design-phase categories: design assumption, plan scope.

## D1 — The figure never animates unless the reader finds "Replay" (design assumption)

The request opens with *"tracing will work best when it's animated"*.
`design.md` sets **"Initial state is step m"** — the complete figure — and the
journey says "Loading the page changes nothing visually, and the reader opts in
with Replay." Research made base-state-is-final a **degradation** rule (JS off,
print, mermaid failure). The design appears to have carried that rule into the
**runtime** state as well, which is a separate decision: a mounted stepper could
reset to step 1 and still degrade identically, because the un-stepped HTML is
unchanged.

**Falsifiable:** as designed, a reader who scrolls the post and never presses a
button sees exactly today's static figures — the feature has zero effect on the
default reading. Is opt-in-on-press intended, or should a mounted figure start at
step 1 (or advance on entering the viewport)?

## D2 — `steps` is candidate D, which research rejected (design assumption)

*"update the mermaid annotations so that each can be animated on its own"* reads
as per-item timing. `research.md` rejected candidate D, a storyboard line, because
it "duplicates information and decouples the tag from the value it times."
`design.md` reintroduces a storyboard line as `steps 9 10 0 1 2 3 11`, and makes
it the **sole** carrier of execution order for the one figure whose order is not
ascending — the `build_art` call, the figure most likely to be wrong. Ordering and
items are then edited in two places, and nothing ties an item's `@L` to a specific
occurrence of L in the header except a positional rule.

**Falsifiable:** as designed, adding a value to the `build_art` figure requires a
matching edit to a header line that names no values. Is an out-of-band execution
order accepted here, or should the callee's order be expressible on the items
(e.g. a second tag component, or an explicit call/return statement)?

## D3 — Repeated lines are only resolved inside one row (design assumption)

*"Stepping through the code will add and update items in the value table."* The
binding rule is scoped: "successive `@L` tags **within one row's value list** take
successive occurrences." Statement-level tags — `frame`, `scope`, `heap`, `ret`,
`done` — sit outside any value list, so when L repeats in `steps`, no rule states
which occurrence they take. Inheritance compounds this: an untagged item takes the
nearest preceding tag in document order, but "document order" and "occurrence
order" are different clocks once a line repeats.

**Falsifiable:** as designed, a loop that allocates a heap object per iteration, or
a call made twice from the same line, cannot be timed — the second `heap … @5` or
`done @5` binds to the first occurrence. Is a repeating figure out of scope for
this feature, or must the occurrence rule cover statements too?

## D4 — The stepper is specified to read S, but S is never emitted (plan scope)

The stepper contract publishes `data-trace-steps="m"`, `data-step="n"`, and
`data-at` on timed elements. The spotlight rule then requires
`L = S[n-1]` — the step→listing-line map — which no listed attribute carries. The
diagram half works from `data-at` alone; the **code half**, which is the half the
request describes ("Each item … happens while reading through the code"), has no
stated transport.

**Falsifiable:** as designed, the stepper cannot spotlight a listing line, because
S exists only inside the parser. Should the figure carry the sequence (e.g.
`data-trace-lines="9 10 0 1 2 3 11"`), or should each step's line ride on the
elements?

## D5 — Verification of ordering stays manual (plan scope)

R5 asked whether the feature should drive a real browser. The design answers with
one feature test plus a manual `playwright-cli` screenshot of step 1 and step m.
The claims most able to break silently are ordering claims — the arrow appearing
with the value that owns it, the spotlight matching the current step, the
`build_art` order — and a screenshot of the two endpoints exercises neither the
middle steps nor the mapping.

**Falsifiable:** as designed, a wrong `steps` list or an arrow bound to the wrong
value passes CI. Is a manual endpoint check sufficient, or should the feature test
assert step-by-step state over a rendered figure?

## Deduped — not raised

- Sigil `@` versus `#` — design resolves it, with the all-digit-heap-id constraint
  stated.
- Dimming past items — design resolves it: only `future` is dimmed.
- Per-figure versus per-post controls — design resolves it: one bar per figure.
- Strike timing — design resolves it: derived from the next value in the row.
- Whether a reveal counts as "animated" (R2) — design resolves it with motion under
  `prefers-reduced-motion: no-preference`.
- What one press of Next does (R3) — design resolves it: steps are executions, and
  m = S.length.
- Renumbering cost of raw line integers (R4) — design resolves it with the
  per-document cost table and the mark-is-an-extent argument.
- Module home, `steps` keyword name, control-bar labels — already Open Artifact
  Decisions.
