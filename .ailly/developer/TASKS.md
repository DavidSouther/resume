# Tasks

## Astrolabe animation refactor — Steps 4–6

Steps 1–3 (body types, pure simulation, `astrolabeView` component tree) are done (2026-06-23). Feature test `frame-render.feature.test.ts` passes.

- **Step 4: Guilloche child reconciliation.** Give `updateGuilloche` ownership of its line children via `reconcileChildren`, replacing per-frame `appendChild`/`removeChild`, the module-level cache, and explicit Ptolemaic clears. Start by filling `guilloche.lines` from `simulateFrame` (currently returns `[]`) and wiring the component to reconcile from it.
- **Step 5: Interaction wiring.** Convert parallax, hover/pin, and drag off raw `addEventListener` onto the `events:` prop path or a small interaction controller feeding `FrameInput`. Isolate layout getters in mutation-free callbacks.
- **Step 6: Consolidate control defaults.** Collapse the triplicated defaults (markup attrs in `pages/astrolabe/page.ts`, `cfg` initializer in `controls.ts`, the Reset handler) to a single source. The animation refactor is done; this step can proceed independently.

Upstream Jiffies issues to file against `@davidsouther/jiffies` (see `.ailly/developer/2026-06-17-B-astrolabe-refactor/design.md` § Summary for context):

- Data props not reflected as DOM attributes (structured prop stringifies to junk via `setAttribute`)
- An attrs-only update that skips re-render (leaves static children alone at 60fps)
- Live adoption of a server-rendered unit without re-render (`attach`-based adopt that doesn't clear)

## Astrolabe materials follow-ups (from 2026-06-16-C)

- Material-accurate bezel sheen: the bezel currently tints `--case` via gradient opacity over the dark page. A true multi-shade metallic gradient per material would read richer; would need light/mid/dark case vars.

- RA-seed re-seeding (`seedFor` in animation.ts): re-places bodies on crossing into/out of Ptolemaic and seeds at `bootMs` rather than the current sim instant. Confirm intent or simplify. One option is to always seed from ecliptic longitude, since `geoDirection` derives the geocentric direction from the heliocentric seed anyway.

## Astrolabe persistence follow-ups (from 2026-06-17-A)

- Debounce the two range-slider persistence writes (`parallax`, `guillocheN`) only if write-on-change proves noisy. The current writer is synchronous on every `input`; a slider drag fires many writes. Add a small debounce around `persist()` for these two inputs if profiling or storage churn shows it matters; otherwise leave it.
- Collapse the triplicated control defaults toward a single source: markup attrs in `pages/astrolabe/page.ts`, the `cfg` initializer in `controls.ts`, and the Reset handler's hardcoded values are three independent copies of the same defaults. (The animation.ts refactor is done; this can proceed without coordination.)

Note: `mise run test` fails `astrolabe.feature.test.ts` because its `spawnSync` build step launches a nested `npm` that resolves Node through NVM, not mise (pre-existing environment issue, not caused by the persistence work). The suite passes when run directly: `mise exec -- npx vitest run`.
