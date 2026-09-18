# Implementation Plan: stepping the trace figure through the code

*Cleared by quick-loop 2026-09-18*

**Feature test:** `src/lib/trace-stepper/trace-stepper.feature.test.ts`

**User story:** A reader presses **Next** on a trace figure and advances one
executed statement — the listing spotlights that statement's line and the value
table reveals exactly the items that statement produces — while a figure with no
timing notation, a page with JavaScript off, and a failed mermaid render all show
today's complete trace.

**Steps:**

- [x] Step 0: API surface area
- [x] Step 1: Timing notation in the model and the parser
- [x] Step 2: Step-sequence resolution (`S`, ordinals, occurrences)
- [x] Step 3: Renderer emits `data-at` on every timed element
- [x] Step 4: Figure-level transport and the seven tagged figures
- [x] Step 5: The stepper module and its control bar
- [ ] Step 6: Presentation, motion, and the visual check

## Amendments this plan carries

The coordinator amended the cleared design. These five decisions bind every step
below.

- **D1 — the stepper mounts at step 1, not at step m.** The goal is animation; a
  figure mounted complete animates nothing. Degradation is unaffected, because
  nothing rewrites the figure before mount, with JS off, on print, or when
  mermaid fails. One named constant in the stepper module holds this, so the
  reversal is one line. **This contradicts three assertions in the feature test,
  which the design phase wrote before the amendment. Step 5 states the exact
  edit.**
- **D2 — `steps` stays, but it is the exception.** Six of the seven figures use
  the default path (ascending unique tagged lines). Only the `build_art` figure
  writes a `steps` statement.
- **D3 — the occurrence rule covers statement-level tags.** `frame`, `scope`,
  `heap`, `ret`, and `done` take successive occurrences of a repeated line
  exactly as values inside a row do, so a repeated line in `steps` can time a
  loop.
- **D4 — `S` reaches the client on the figure.** `data-trace-lines="9 10 0 1 2 3 11"`
  is written by `pairListingsWithDiagrams` in `src/lib/markdown.ts` at build
  time. Step 4 states why that module owns it and not the client renderer.
- **D5 — ordering is verified in CI.** Step 5 adds a table-driven test that
  asserts, for all seven steps of the `build_art` figure, the exact element
  revealed and the exact line spotlit at each step index.

## Hard requirements

Every step must hold these. A step that breaks one is not green.

1. Every existing untagged `traceDiagram` in `posts/` renders byte-identically.
   `src/lib/trace-diagram/trace-diagram.feature.test.ts` and
   `render-trace.test.ts` pin this and must stay unmodified and green.
2. With JavaScript off, before mount, on print, or after a mermaid failure, the
   figure is the complete trace.
3. The control bar is keyboard-operable, its state is announced through
   `aria-live`, the SVG stays screen-reader readable, and nothing is ever
   `aria-hidden` or `display: none`.
4. `prefers-reduced-motion: reduce` collapses all motion to an instant opacity
   change. Nothing is suppressed.

## Libraries & Skills

Load these through the harness's skill-loading mechanism at the start of **every**
red-green-refactor step:

- `using-jiffies-dom` — `/Users/david.souther/devel/jefri/jiffies/skills/using-jiffies-dom/SKILL.md`.
  The renderer builds SVG with `@davidsouther/jiffies/dom/svg.ts` helpers
  (`render-trace.ts:11-18`); new `g` wrappers use them, never raw DOM.
- `using-ssg-cli` — `/Users/david.souther/devel/jefri/jiffies/skills/using-ssg-cli/SKILL.md`.
  Covers `clientModules` and the Rollup client bundle.
- `jiffies-css-components` — `/Users/david.souther/devel/jefri/jiffies/skills/jiffies-css-components/SKILL.md`.
  Needed for the control bar, which is new visible chrome.

Per `AGENTS.md`: invoke TypeScript as `node script.ts`, never with
`--experimental-strip-types`. Gates are `mise run check` and `mise run test`.
Format with `npx biome check --write`; never hand-edit whitespace.

## Step 0: API surface area

Applicable patterns, per `patterns:using-patterns`:

- **parse-dont-validate** (`references/patterns/parse-dont-validate.md`) — diagram
  text is untrusted input. A tag that reaches the renderer is already a resolved
  step ordinal; no downstream code re-checks a raw line number.
- **domain-objects** (`references/patterns/domain-objects.md`) — `Timed` is a value
  object mixed into the existing model nodes. It carries no identity.
- **type-conversion** (`references/patterns/type-conversion.md`) — `resolveSteps`
  is the one conversion from author-facing listing lines to renderer-facing step
  ordinals. It exists once, so the renderer and the build-time figure writer
  cannot disagree.
- **errors-typed-untyped** (`references/patterns/errors-typed-untyped.md`) — no new
  error type. Every timing failure throws the existing `TraceSyntaxError` with a
  diagram line and column.
- **visibility** (`references/patterns/visibility.md`) — the stepper exports
  `mountTraceSteppers` alone; its per-figure state is module-local.

New and changed signatures, stubs only:

```ts
// src/lib/trace-diagram/model.ts

/**
 * One point in the trace's timeline. `tag` is the author's 0-based listing line;
 * `step` is the 1-based ordinal resolved against the step sequence.
 */
export interface Timed {
	/** Author's `@<digits>`, absent when the item inherits. */
	tag?: number;
	/** Document position across heap and frames, for inheritance and occurrence. */
	order: number;
	/** 1-based diagram source line, for TraceSyntaxError positions. */
	sourceLine: number;
	/** Resolved 1-based step ordinal. Absent when the diagram is untimed. */
	step?: number;
}

export interface TraceValue extends Timed { /* unchanged fields */ }
export interface Row extends Timed { /* unchanged fields */ }
export interface HeapObject extends Timed { /* unchanged fields */ }
export interface HeapField extends Timed { /* unchanged fields */ }

export interface Frame extends Timed {
	/* unchanged fields, including `done: boolean` */
	/** Timing of the frame's `done`, which is a second event on one frame. */
	doneAt?: Timed;
}

export interface TraceModel {
	title?: string;
	frames: Frame[];
	heap: HeapObject[];
	/** From a `steps` statement. Absent means "derive the default sequence". */
	declaredSteps?: number[];
}
```

```ts
// src/lib/trace-diagram/steps.ts  (new)

/**
 * The resolved step sequence: `S[n-1]` is the 0-based listing line executed at
 * step n. Empty when the diagram carries no timing notation at all.
 */
export type StepSequence = readonly number[];

/**
 * Resolves S and writes `step` onto every timed node of `model`, in place.
 * Returns S. Returns `[]` and writes no `step` when nothing is tagged and no
 * `steps` statement was written — that is the backward-compatible path.
 *
 * Throws TraceSyntaxError when a tag names a line absent from an explicit
 * `steps` list.
 */
export function resolveSteps(model: TraceModel): StepSequence;

/** Parses `source` and resolves its sequence without drawing. Build-time entry. */
export function resolveStepsFromSource(source: string): StepSequence;
```

```ts
// src/lib/trace-stepper/stepper.ts  (new)

/**
 * Mounts a step control on every steppable `figure.trace-figure` under `root`.
 * A figure is steppable when it carries `data-trace-lines` and holds at least
 * one `[data-at]` element. Returns the number of figures mounted.
 */
export function mountTraceSteppers(root: ParentNode): number;
```

```ts
// src/lib/markdown.ts — signature unchanged, behaviour extended
export function pairListingsWithDiagrams(html: string): string;
```

## Step 1: Timing notation in the model and the parser

**Enables:** nothing in the feature test yet; it unblocks every later step. After
this step `parseTrace` accepts the tagged `build_art` diagram without throwing,
which it does not today.

The parser learns two things and nothing else changes.

**The trailing tag is peeled before dispatch.** After `%%` comments are stripped
and the line is trimmed, peel one `/\s*@(\d+)$/` into `trailingTag` and re-trim
the remainder. Every existing statement regex then runs against the remainder
unchanged. This is load-bearing for `ret`: `ret &art -> my_art @2` fed to today's
`/^ret\s+(.+?)(?:\s*->\s*(\S+))?$/` silently swallows the arrow target into the
value, losing `returnsTo`. Peeling first removes that whole class of bug.

**Where the peeled tag lands.** For a statement with no value list — `frame`,
`scope`, `heap`, `done` — it is the statement's tag. For a statement with a value
list, `parseValues` additionally strips a trailing `@<digits>` from each
comma-separated token (so `a: 1071 @5, 609 @5` times two values), and the peeled
`trailingTag` attaches to the **last value** when the list is non-empty, or to the
**row itself** when the list is empty. `my_art: @10` is therefore a row tag, and
`art: @artwork @1` is a value tag.

Disambiguation is lexical and is a documented constraint: `@artwork` is a heap
pointer, `@1` is a step tag, so **a heap object id may not be all digits**. No
existing diagram violates it.

**The `steps` statement.** At most one, before the first `frame`, `scope`, or
`heap`; `/^steps\s+(\d+(?:\s+\d+)*)$/` into `model.declaredSteps`.

**`order` and `sourceLine`** are assigned by a counter as the parser walks, which
is the only place true document order across heap blocks and frames exists.

**Tests** — `src/lib/trace-diagram/parse.test.ts`

```
test "a tag times the value it trails":
  model <- parseTrace("traceDiagram\n frame main @0\n  art: 7 @1\n  done @2\n end\n")

  assert model.frames[0].tag is 0
  assert model.frames[0].rows[0].values[0].tag is 1
  assert model.frames[0].rows[0].tag is undefined
  assert model.frames[0].doneAt.tag is 2
```

- `my_art: @10` — empty value list, so the tag is the row's and `values` is `[]`.
- `ret &art -> my_art @2` — `returnsTo` survives the peel and is `"my_art"`.
- `art: @artwork @1` — `pointsTo` is `"artwork"`, the value's tag is `1`.
- `a: 1071 @5, 609 @6` — per-token tags, two values, two tags.
- `heap artwork 0x08 @1` — the address still parses; the tag is the object's.
- `steps 9 10 0 1 2 3 11` — `declaredSteps` is the seven integers.
- Two `steps` statements, or a `steps` after a `frame` — `TraceSyntaxError` with
  the diagram's line and column.
- An untagged diagram — every `tag` is `undefined`, `declaredSteps` is absent,
  and the whole existing `parse.test.ts` suite passes unmodified.

**Implementation Outline**

```
parseTrace(text):
  order <- 0
  for each raw line:
    strip %% comment, trim
    trailingTag, line <- peelTrailingTag(line)
    ... existing dispatch on `line`, unchanged ...
    when a node is constructed: node.order <- order++, node.sourceLine <- index + 1
    when the node has values: parseValues strips per-token tags;
      trailingTag -> last value if any, else the node
    when the node has no values: trailingTag -> the node
```

## Step 2: Step-sequence resolution

**Enables:** `expect(figure.dataset.traceSteps).toBe("7")` — the count exists once
S does.

`src/lib/trace-diagram/steps.ts` is new and pure. It holds the one definition of
the timeline, so the renderer and the build-time figure writer cannot drift.

**S.** `model.declaredSteps` when written; otherwise the ascending sorted unique
tagged lines. `[]` when nothing is tagged and nothing is declared — the
backward-compatible path, which writes no `step` anywhere.

**m = S.length.** Step n executes the statement on listing line `S[n-1]`.

**Inheritance.** Collect every timed node, sort by `order`, and give an untagged
node the tag of the nearest preceding tagged node. A node with no preceding tag
belongs to step 1.

**Occurrence, covering statements as well as values (D3).** Let `occ(L)` be the
number of times L appears in S.

- `occ(L) === 1` — every node tagged `@L` resolves to that one step. Two values in
  different rows carrying the same tag therefore share a step, which is reveal.js's
  repeated `data-fragment-index`.
- `occ(L) > 1` — nodes tagged `@L` take successive occurrences of L in S, in
  document `order`, values and statements alike. More tags than occurrences clamp
  to the last occurrence.

This is the rule that lets `steps 4 5 6 5 6 5` replay a loop as a, b, a, b, a, and
it is what the design's row-scoped rule could not do for `heap` or `done`.

**Validation.** A tag naming a line absent from an explicit `steps` list throws
`TraceSyntaxError` carrying the node's `sourceLine`. A `steps` entry past the end
of the listing is not detectable here — the parser never sees the listing — and is
handled at mount in Step 5.

**Tests** — `src/lib/trace-diagram/steps.test.ts` (new)

```
test "an explicit sequence orders a callee before the lines above it":
  model <- parseTrace(the build_art diagram, tagged)

  sequence <- resolveSteps(model)

  assert sequence equals [9, 10, 0, 1, 2, 3, 11]
  assert the `my_art` row.step is 2
  assert the `art` row's first value.step is 4
  assert the inner frame.step is 3 and its doneAt.step is 6
```

- No tags, no `steps` — returns `[]`, and no node gains a `step`.
- Tags only — S is the ascending unique tagged lines (the six-figure default).
- Two nodes tagged the same line with `occ === 1` — both resolve to one step.
- A line repeated in `steps` — a `heap` and a `done` both tagged `@5` take the
  first and second occurrences in document order (D3).
- More tags than occurrences — the surplus clamps to the last occurrence rather
  than throwing.
- A tag absent from an explicit `steps` list — `TraceSyntaxError` naming the
  diagram line.

**Implementation Outline**

```
resolveSteps(model):
  nodes <- every Timed in model.heap and model.frames, plus each frame.doneAt,
           sorted by order
  if no node has a tag and model.declaredSteps is absent: return []
  S <- model.declaredSteps ?? ascending unique tags
  inherited <- undefined
  taken <- map line -> count
  for node in nodes:
    line <- node.tag ?? inherited
    if node.tag is defined: inherited <- node.tag
    positions <- indexes of line in S
    if positions is empty: throw TraceSyntaxError at node.sourceLine
    k <- min(taken.get(line) ?? 0, positions.length - 1)
    node.step <- positions[k] + 1
    if positions.length > 1: taken.set(line, k + 1)
  return S
```

*Built as:* an untagged node takes the **resolved step** of the nearest
preceding tagged node, not its line. Only a node carrying its own `@L` consumes
an occurrence of L. The outline's shared `taken` counter would otherwise make a
heap object's untagged fields consume the object's later occurrences and land on
different steps. Every listed Step 2 test behaves identically either way.

## Step 3: Renderer emits `data-at` on every timed element

**Enables:** `state(figure, "my_art")`, `state(figure, "Artwork Liberty")`, and
`figure.querySelector('.trace-return-arrow[data-state="current"]')` — none of which
can resolve today, because there is no per-value element.

This is the surgery. `drawTrace` calls `resolveSteps(model)` once at the top; when
it returns `[]` the renderer emits **no** timing attribute and **no** new element,
so an untagged diagram is byte-identical. Everything below is conditional on a
non-empty sequence.

**The value group — `render-trace.ts:283-317`.** A value is two sibling nodes
inside `g.trace-row` today. Wrap the value's text label alone in
`g.trace-value-item[data-at="<step>"]`. The strike **line stays a sibling** of that
group, carrying its own `data-at` equal to the *next* value's step in the same row,
because a strike appears when the value that supersedes it appears. A strike placed
inside the value's group would be revealed with the value it cancels.

The row's name label `text.trace-name` carries `data-at` equal to the row's own
step when the row is tagged, otherwise the step of its first value. This is what
makes an empty-valued row like `my_art:` timeable at all, and it is what the
feature test's `state(figure, "my_art")` reads.

`g.trace-row` itself must **not** carry `data-at`: it contains the name and every
value, so a state on the group would shadow its children in document order and
`state()` would read the wrong element.

**The four derived passes take the same attribute**, each from the value or
statement that owns it, so an arrow never precedes or outlives its value:

- Return arrows, `:357-384` — the `ret` row value's step.
- Stack pointers, `:389-413` — the owning value's step.
- Heap-to-heap pointers, `:558-573` — the owning heap field's step.
- Value-column heap pointers, `:577-591` — the owning value's step.

**Two more**: the frame's opening rule and `.trace-frame-label` take the frame's
step (`:218-245`); `path.trace-frame-done` — the X, `:331-354` — takes
`frame.doneAt.step`. The attribute goes on the path, not the enclosing group.

Title, column headers, the vertical divider, and the heap card chrome stay
untimed and so are never dimmed.

**Tests** — `src/lib/trace-diagram/render-trace.test.ts`

```
test "each value is independently timed":
  svg <- renderTrace(the tagged build_art diagram, a fragment)

  group <- svg.querySelector('.trace-value-item[data-at="4"]')
  assert group.textContent is "Artwork Liberty"
  assert svg.querySelector('.trace-return-arrow').dataset.at is "5"
  assert svg.querySelector('.trace-frame-done').dataset.at is "6"
```

- An untagged diagram — `svg.querySelector("[data-at]")` is null and
  `.trace-value-item` does not exist. Assert the serialized SVG string equals the
  string the renderer produces today, so hard requirement 1 is pinned here and
  not left to Step 6.
- A struck value — the strike line's `data-at` is the *next* value's step, and it
  is a sibling of the value group, not a child.
- A value in a row whose only tag is on the row — the value inherits the row's
  step.
- The heap card and its fields carry the heap object's step.
- `trace-diagram.feature.test.ts` and `paper-diagrams.feature.test.ts` stay
  unmodified and green.

*Built as:* one `timing(step)` helper returns `{ "data-at": step }` or `{}`, and
`resolveSteps` writes no `step` at all on an untimed diagram, so the empty-
sequence path needs no second guard — the single `timed` boolean guards only the
`g.trace-value-item` wrapper. Four details the plan left open:

- A terminal `~v~` has no superseding value, so its strike takes the struck
  value's own step rather than an absent successor's.
- Heap field values go through the same `valueCells` helper as stack values, so
  a heap value is a `g.trace-value-item` too. The heap card carries the object's
  step, its field name labels carry the field's.
- A `ret` row's return arrow takes the **last** value's step, because the peeled
  trailing tag of `ret &art -> my_art @2` lands on that value.
- Byte-identity is pinned by `untagged-baseline.svg`, written by the renderer at
  the commit before `data-at` existed, plus the source that produced it in
  `untagged-baseline.source.txt`. The test compares `svg.outerHTML` to the
  fixture, so the pin is the real prior output and not a restatement of the
  current one.

## Step 4: Figure-level transport and the seven tagged figures

**Enables:** the spotlight half of the feature test —
`spotlightLine(figure)` on every press — and `data-trace-steps` being `"7"`.

**Who writes `S` to the client (D4).** `pairListingsWithDiagrams` in
`src/lib/markdown.ts:70-77`, at build time. Its two regexes already capture the
`<pre class="mermaid">` body; the replacement becomes a function that unescapes
that body with the module's existing `unescapeHtml`, calls
`resolveStepsFromSource`, and, when the sequence is non-empty, emits
`<figure class="trace-figure" data-trace-lines="9 10 0 1 2 3 11">`.

The alternative — `drawTrace` writing the attribute on its SVG root — was
rejected. `diagram.ts:34-48` draws into a detached fragment and copies only
`childNodes` and five named attributes onto mermaid's host element, so a root
attribute would be silently dropped unless a second module were also edited, and
it would then have to survive mermaid's `securityLevel: "strict"` sanitizer.
Build time has no such plumbing: the figure element is authored there, the parse
is pure, and the attribute is in the shipped HTML.

The resolution parse is wrapped in try/catch. A diagram that fails to parse
yields today's unstepped figure rather than breaking the build, which preserves
the existing degradation rule.

`data-trace-steps` and `data-step` are **not** written here — the stepper owns
them, so the count has one writer.

**The seven figures.** `posts/interview_07_tracing_rust/post.md`. Six of them
trace straight-line bodies inside `main` and use the **default** path: tags only,
no `steps` statement (D2). The first figure, at fence 123, becomes:

```
traceDiagram
  title A plain owned value
  heap artwork 0x08 @1
    name: Owain
    view_count: 0
  end
  frame main @0
    art: @artwork @1
    watch art.name: Owain @2
    done @3
  end
```

Its default sequence is `[0, 1, 2, 3]`. The seventh figure, at fence 360, is the
only one whose execution order is not ascending, so it declares its own:

```
traceDiagram
  title Static check of a returned local reference
  steps 9 10 0 1 2 3 11
  frame main @9
    my_art: @10
    frame build_art @0
      art: Artwork Liberty @1
      ret &art -> my_art @2
      watch return: rejected @2
      done @3
    end
  end
```

Listing lines 9, 10, 0, 1, 2, 3, 11 are `fn main() {`,
`let my_art = build_art();`, `fn build_art<'a>() -> &'a Artwork {`,
`let art = artwork("Liberty");`, `&art // rejected return`, `}`, and
`show_art(&my_art);`.

**Tests** — `src/lib/markdown.test.ts`

```
test "a tagged diagram publishes its sequence on the figure":
  html <- toHTML(a gutter listing followed by a tagged traceDiagram)

  assert html contains 'data-trace-lines="0 1 2 3"'
```

- An untagged diagram — the figure has no `data-trace-lines` and the emitted
  string is byte-identical to today's.
- A diagram whose source contains `&amp;` — unescaping runs before the parse, so
  `ret &art -> my_art` resolves.
- A malformed diagram — no attribute, no thrown error, the figure still pairs.
- The plain-code-fence pairing (`CODE_THEN_DIAGRAM`) gets the attribute too.
- A post-level assertion that the `build_art` figure of
  `interview_07_tracing_rust` carries exactly `"9 10 0 1 2 3 11"`.

*Built as:* the two pairing replacements became functions rather than
replacement strings, so a `&` in a listing cannot be read as a `$&`
back-reference. `MERMAID_BODY` peels the `<pre class="mermaid">` wrapper off
capture group 2 before `unescapeHtml`; a diagram that fails either the peel or
the parse yields today's unstepped figure. The six default-path figures resolve
to `[0,1,2,3]`, `[0,1,2,3,4]`, `[0,1,2,3]`, `[0..6]`, `[0..10]`, and `[0..5]`;
`build_art` resolves to `[9,10,0,1,2,3,11]`. The unescaping test uses a heap
pointer field (`next -> box`), because the escaped `-&gt;` form throws where an
escaped `&amp;art` alone still parses — only the pointer discriminates.

## Step 5: The stepper module and its control bar

**Enables:** the whole feature test.

**The feature test needs three edits first**, because D1 reverses the mount state
the design phase asserted. Make them before writing the module, so the step starts
red for the right reason:

- Line 80-81's comment — the figure now mounts at its first execution.
- Line 84 — `expect(figure.dataset.step).toBe("1")`.
- Line 86 — `toMatch(/Step 1 of 7/)`.
- Add, after the return-arrow assertion at line 115, a `press(figure, "Replay")`
  followed by `expect(figure.dataset.step).toBe("1")`, so Replay is exercised from
  a step other than the first. The existing press at line 88 stays and is
  idempotent.

Nothing else in the test changes. Every other assertion — execution order, the
upward spotlight jump, `past`/`current`/`future`, the return arrow, the
accessibility guarantees, and the untagged-figure zero — is unaffected by D1.

**The module.** `src/lib/trace-stepper/stepper.ts`, exporting
`mountTraceSteppers(root: ParentNode): number`. `src/components/mermaid/client.ts`
calls it after `bootMermaid()` resolves, because the SVG does not exist before
that. `clientModules` on `pages/blog/[id]/page.ts` is unchanged.

**The D1 constant, alone at the top of the module:**

```ts
/** D1: a mounted figure starts at its first execution, because the feature is
 *  animation. Set to `false` to mount complete instead — a one-line reversal. */
const MOUNT_AT_FIRST_STEP = true;
```

**A figure is steppable** when it carries `data-trace-lines` and holds at least one
`[data-at]`. The second condition is what keeps a mermaid failure from growing a
control bar, and what makes the feature test's untagged `plain` figure return 0.

**State.** `data-trace-steps="m"` and `data-step="n"` on the figure.
`data-state="past" | "current" | "future"` on every `[data-at]`, by comparing its
`data-at` to n. Only `future` is dimmed. The listing's
`.highlight-gutter-line[data-line="S[n-1]"]` takes `data-state="current"`, with the
previous one cleared. A figure whose listing is a plain code fence has no
`data-line` spans and simply spotlights nothing.

**Controls.** `<div class="trace-stepper" role="group" aria-label="Step through the
trace">` appended inside the figure, holding three
`<button type="button">` elements labelled **Replay**, **Previous**, **Next**, and a
`<p role="status" aria-live="polite">` reading `Step n of m — <the spotlighted
source line>`. `ArrowLeft`, `ArrowRight`, and `Home` act while focus is inside the
figure. Previous and Next disable at the ends. Nothing is ever `aria-hidden` or
`display: none`.

**A `steps` entry past the end of the listing** is detected here: skip the
spotlight for that step, `console.warn` once per figure, and keep the diagram
steppable.

**Tests** — `src/lib/trace-stepper/stepper.test.ts` (new, jsdom)

The D5 test is table-driven over the whole sequence, not the endpoints:

```
test "every step reveals the right element and spotlights the right line":
  figure <- the rendered build_art figure, mounted

  for n in 1..7:
    goTo(figure, n)

    assert spotlightLine(figure) equals EXPECTED_LINES[n - 1]
    assert the set of [data-state="current"] elements equals EXPECTED_CURRENT[n - 1]
```

`EXPECTED_LINES` is the seven listing lines named in Step 4. `EXPECTED_CURRENT`
names the elements: step 1 the `main` frame rule and label; step 2 the `my_art`
name label; step 3 the `build_art` frame rule and label; step 4 the `art` name
label and its `Artwork Liberty` value; step 5 the `ret` row, its `&art` value, the
return arrow, the stack pointer, and the `return: rejected` watch; step 6 the
frame X; step 7 nothing in the diagram.

- Next at step m and Previous at step 1 do nothing, and those buttons are
  `disabled`.
- Replay from step m returns to step 1.
- `ArrowRight`, `ArrowLeft`, and `Home` inside the figure match Next, Previous,
  and Replay; the same keys outside the figure do nothing.
- A second `mountTraceSteppers(document)` on an already-mounted page adds no
  second control bar and returns the same count.
- A figure with `data-trace-lines` but no `[data-at]` — the mermaid-failure case —
  is not counted and gets no control bar.
- A `steps` entry past the listing's last line — no spotlight, one warning, still
  steppable.
- Two figures on one page step independently.

**Patterns:** **arrange-act-assert** for each unit test;
**triangulate** for the table-driven D5 test, which is the second example that
forces real sequence lookup rather than a hardcoded first step;
**page-objects** for the `state`, `spotlightLine`, and `press` helpers the feature
test already defines — reuse them in `stepper.test.ts` rather than re-deriving
selectors.

*Built as:* the page-object helpers are re-declared in `stepper.test.ts` rather
than imported, because the plan forbids any edit to the feature test beyond the
four D1 reversals and a `.feature.test.ts` is a poor export surface.

`role`, `aria-live`, `aria-label`, and `disabled` are set with `setAttribute`
and property assignment: jiffies' typed attr map admits none of them, and
`tsc --noEmit` rejects each as an attrs key. The keydown listener sits on the
figure, not on the control bar, so the keys act while focus is anywhere inside
the figure and never outside it.

`data-trace-mounted` on the figure is the idempotence marker: a second
`mountTraceSteppers(document)` counts an already-mounted figure but builds no
second bar.

The D5 table names each revealed element by `class:text`. Step 5 reveals six
elements in document order — the `ret` name, `&art`, the `return` name,
`rejected`, the return arrow, and the stack pointer — because the renderer
emits rows before the derived arrow passes.

## Step 6: Presentation, motion, and the visual check

**Enables:** nothing new in the feature test, which runs headless. This step
satisfies hard requirements 2 and 4, which jsdom cannot observe.

**CSS.** Diagram-internal rules go in `src/lib/trace-diagram/styles.ts`, which
mermaid injects into the generated SVG; the control bar and the listing spotlight
go in `src/global.css` beside the existing `.trace-figure` block at 556-593 and
`.highlight-gutters` at 740-877. Consume the derived `--size-*` and
`--font-size-*` tokens; a raw rem or px is the signal of a missing token.

Base rule: `[data-at]` is fully opaque, and `[data-state="future"]` is dimmed.
Untimed elements have no rule at all, so a figure that never mounts is untouched.

Under `@media (prefers-reduced-motion: no-preference)`: a newly revealed value
fades and slides a short distance into its cell, an arrow draws along its path
with `stroke-dasharray`/`stroke-dashoffset`, a strike wipes across the value it
cancels, and the listing's spotlight bar slides to the new line. Under
`prefers-reduced-motion: reduce` every one of these is an instant opacity change —
no transform, no path drawing, no transition duration. The site already does this
twice, in `src/components/flashcards/css.ts:258` and `src/lib/astrolabe/css.ts:193`.

The stepper never advances on its own, so WCAG 2.2.2 does not engage.

**Tests**

- A styles unit test asserting that the reduced-motion block sets no `transform`
  and no non-zero `transition-duration`.
- Manual, per `AGENTS.md`: `node scripts/serve.ts --port 8080` (reuse an existing
  server if 8080 is taken), then `playwright-cli` against
  `http://127.0.0.1:8080/blog/interview_07_tracing_rust/`. Screenshot the
  `build_art` figure at steps 1, 4, and 7; tab to the control bar to confirm focus
  is visible and the buttons are reachable; re-run with reduced motion forced.
- Print preview and a JavaScript-off load both show the complete figure.
- Final sweep: `mise run check` and `mise run test` green, with
  `trace-diagram.feature.test.ts`, `render-trace.test.ts`,
  `paper-diagrams.feature.test.ts`, and `parse.test.ts` unmodified.

## Coordinator amendments (post plan intent review, 2026-09-18)

These override the plan body where they conflict. They answer P1–P4 of
`reviews/2026-09-18-plan-intent-review.md`.

- **P1 — a future item is invisible, not dimmed.** The request says stepping
  *adds* items. `[data-state="future"]` therefore renders at `opacity: 0` with
  its layout reserved, so the table does not reflow as items arrive. It stays
  in the DOM and in the accessibility tree: no `display: none`, no
  `visibility: hidden`, no `aria-hidden`. `past` renders at full strength;
  `current` carries the emphasis.
- **P2 — backward motion is instant.** Previous and Replay set `data-step` with
  transitions suppressed for that frame, so no reverse un-draw plays. Only
  forward motion animates.
- **P3 — the whole page resets at mount.** `mountTraceSteppers(document)` puts
  every tagged figure at step 1. Only a figure carrying tags is touched, so the
  twenty-five untagged diagrams elsewhere are unaffected. The one named
  constant from D1 reverses this.
- **P4 — scope is `posts/interview_07_tracing_rust/post.md` only.** The six
  diagrams in `posts/interview_03_tracing.md` and the nineteen in
  `posts/memory_diagrams_papers_mermaid.md` stay untagged and byte-identical.
