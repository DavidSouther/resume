# Reference materials that would have let the Astrolabe be born as FCCs

*Retrospective — 2026-06-25. What follows is the answer to: "had these been on hand
the day the Astrolabe was first written, it would have been FCC code, not vanilla
DOM that we then spent a multi-feature refactor converting."*

## 1. What the refactor actually was

The original Astrolabe was raw, imperative DOM: `document.createElement`,
`getElementById`, hand-wired `addEventListener`, a 22-field `ControlHandles` bag,
`bindRange`/`bindCheck`/`setChk` event-replay glue, and read-the-DOM-back snapshots.
The refactor (`cf0b98d` → `9c545f3`) rebuilt the same pixels on the jiffies
**FCC** (containerless functional component) model: render-once and dynamic FCCs in
`components.ts`, a `ControlsDrawer` FCC composing dumb leaf controls in
`controls-components.ts`, a single serializable `ControlsState` as source of truth,
and a thin controller. ~2200 insertions / 1700 deletions, five features, two review
passes (`review.md`, `review_2.md`).

None of that work discovered *new* product behaviour. It was almost entirely a
**model-knowledge gap** — but not the gap I first named. The original code didn't
pick the *wrong* jiffies component form; it used **no jiffies DOM idiom at all**.
There was no `div(...)`/`.update()`, no `FC`, no `FCC` — just `document.createElement`
and `getElementById`. That's the tell: the framework's DOM reference was simply not
on hand. When the lowest-common-denominator you can write without a reference is raw
DOM, raw DOM is what you get — even though the plain reentrant form (`div()`,
`.update()`, `events:`) was the right tool and was fully documented all along.

## 2. Skill-definition review (why the gap survived to build time)

The `developer:ailly` loop and its phase skills are framework-agnostic by design.
Re-reading them against this refactor, the gap is structural, not a bug:

- **`developer:research`** gathers context with a dual lens (general practice + this
  codebase) and asks "does an off-the-shelf tool already do this?" — but it has no
  beat that says *"identify the UI/component framework this project is built on and
  load its component-authoring reference before designing."* The Astrolabe's
  framework (jiffies FCC) was an off-the-shelf tool that already did the thing, and
  research never surfaced it.
- **`developer:design`** explores alternatives and writes the feature test, but with
  no framework reference loaded it will explore *vanilla* alternatives, because that's
  what's in context. Design quality is bounded by the references on hand.
- **`developer:plan` / `red-green-refactor`** then faithfully execute against whatever
  the design assumed.

The loop has no "framework primer" gate. That's the single highest-leverage fix:
**research should detect the project's component framework and pull its authoring
SKILL/docs into context before design begins** — the same way it already reaches for
domain/pattern skills. Had that one beat fired, the original code would have opened
`using-jiffies-dom` and reached for `div()`/`.update()` instead of `createElement`.

## 3. The reference that should have been on hand

There is exactly **one** reference at the center of this: `using-jiffies-dom`. It is
not missing as a *document* — it is missing as something the resume author can *load*,
and it needs to cover the full spectrum of jiffies DOM forms so the author picks the
right one. It is one skill, not two; an FCC section belongs inside it, not in a
parallel doc.

### A. `using-jiffies-dom` — exists, but was not on hand

`/Users/david.souther/devel/jefri/jiffies/src/dom/SKILL.md` is a genuine
component-authoring skill: reentrant create-or-update, `.update()` identity
reconciliation, `events:` wiring, `class`/`"!class"`, `style`, the
attrs-vs-first-child rule, correct `@davidsouther/jiffies/dom/*.ts` import paths,
and `FC` stateful components. **This alone — the plain reentrant form — is what the
original Astrolabe should have used.** The vanilla detour didn't happen because this
content was wrong or incomplete for the *original* job; it happened because the skill
was never in context.

The reason it was not on hand: it lives in a *sibling local checkout*
(`devel/jefri/jiffies`), not in `node_modules` (the published package ships zero
markdown), and it is not registered as a Claude skill. From inside the resume there
was no path to it. **Fix: register it as an installed skill reachable from this repo**
(symlink into the skills set, or vendor it). A reference you can't load is not on hand,
and that — not any FC/FCC distinction — is what produced raw DOM.

### B. The same skill must span plain → FC → FCC

The skill should walk all three jiffies DOM forms and *when to pick each*, so the
author who loads it lands on the right one instead of dropping to vanilla:

1. **Plain reentrant nodes** — `div()`/`span()` + a held reference and `.update()`.
   The form the original Astrolabe wanted. Already documented.
2. **`FC`** — stateful custom elements that re-render from props. Already documented.
3. **`FCC`** — containerless components with a boundary element, hydrated from SSG
   HTML. **The skill's grep for `fcc`/`hydrate`/`boundary` returns 0** — this form is
   undocumented, and it's the one the refactor settled on. Extend the *same* skill to
   cover it, seeded from `fc.ts:139-166` + `hydrate.ts` and the in-repo precedents.

The FCC section (the part that was genuinely undocumented) needs to carry the lessons
the refactor paid for, all now sitting in private memory:

- **Every prop is written to the boundary as an attribute** (`applyUpdate`,
  `fc.ts:51`). A function prop (`onChange`/`onToggle`) lowercases to an
  `onchange`/`ontoggle` *content attribute* the browser/jsdom compiles as a live
  inline handler on bubble — a hard crash; objects become `"[object Object]"` junk
  that serializes into SSG HTML. **Pass callbacks/objects via factory closure**
  (`makeDisc(key)` precedent, `components.ts:219`), via `events:`, or a `.wire()`
  method; pass only DOM-valid dynamic values (`checked`, `value`) as props.
  → memory `jiffies-fcc-attrs-hit-boundary`.
- **The `.update()` graft does not survive SSG serialize→reparse.** A page-emitted
  element re-parsed in the browser is a new object with no `.update()`;
  `el?.update?.(...)` is a silent production no-op. Drive raw page-emitted elements
  with **`up()`** from `dom/dom.ts`; guard with a round-trip test
  (`frame-roundtrip.feature.test.ts`).
  → memory `jiffies-update-graft-lost-on-ssg-reparse`.
- **SSG-build-time construction:** use `window.document` (jiffies sets `global.window`,
  not bare `document`); guard `getComputedStyle` (absent at SSG).
- **The component API law:** attrs object + flat rank-1 children; singular regions are
  named slots in attrs, never scalar-or-array positional params.
  → memory `jiffies-component-api-law`.
- **Single-handler-per-event**, and "apply-your-effect in render driven by the value
  you got back, never as a second listener" — the discipline that replaced the
  `bindRange`/`setChk` glue.

These lessons are distilled across the memory notes; promoting them into the loadable
skill is what lets the *next* author start where this refactor ended.

### C. jiffies-css references (adjacent, already partly captured)

Not the cause of the FCC/vanilla split, but the same "load the framework's reference
first" discipline applies to styling, and these were also learned the hard way:

- `jiffies-css/PHILOSOPHY.md`, `THEMES.md`, `DESIGN.md`, and
  `skills/jiffies-css-theming/SKILL.md` — Intent→Derivation→Application tiers, the
  derived `--size-*`/`--font-size-*` scale, the Zen-Garden "raw px = missing token"
  test, and the `:root`-scoped M3 role derivation.
  → memories `jiffies-css-token-scale`, `jiffies-css-use-derived-tokens`,
    `jiffies-theme-derivation-root-scoped`.

### D. Runtime/build constraints (project-level, already in AGENTS.md + memory)

`node script.ts` (no `--experimental-strip-types`); `~/` is typecheck-only so value
imports are relative `.ts`; deps that ship `.ts` source must compile to JS.
→ `node24-no-strip-types-flag`, `tilde-alias-typecheck-only`,
  `node24-no-strip-types-in-node-modules`.

## 4. The one change with the most leverage

Two moves, both about the *same single reference*:

1. **Make `using-jiffies-dom` loadable from this repo** (register/symlink/vendor it),
   and extend that one skill to span plain → FC → FCC with a "when to pick each"
   section, folding in the FCC lessons from the `jiffies-fcc-*`/`jiffies-component-*`
   memories and the in-repo precedents above.
2. **Add a research-phase beat that loads the project's component-framework reference
   before design.**

That's it. There is no second skill to write — the failure was a reference not on
hand, not a missing document. Wire it in, and this refactor becomes a thing the next
author *reads* instead of a thing that *happens*.
