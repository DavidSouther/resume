# TASKS

Next-step queue for `developer:ailly` sessions in this repo.

## Follow-ups

- **manifold paper + post (LLMs as a model of syntactic space)** — A **project**
  (project loop; see [.ailly/developer/2026-06-25-C-manifold/design.md](2026-06-25-C-manifold/design.md),
  phase: Review). Turn the blog-tone draft into a synthesis/position paper whose
  contribution is the **agentic-workflow lens**, not a new formalism. Deliverables:
  the blog post [posts/llm_manifold/post.md](../../posts/llm_manifold/post.md) and
  the paper [llm_manifold/paper.md](../../llm_manifold/paper.md) (Markdown + pandoc
  target; IEEE cites in [llm_manifold/refs.bib](../../llm_manifold/refs.bib) + an
  `ieee.csl`). Research (5 sweeps + 13 PDFs) and the design moved here from the
  `ailly_two` repo; **load-bearing finding:** the manifold/categorical/phase-space
  vocabulary is already published (esp. Bradley–Terilla–Vlassopoulos's enriched
  category of texts with LM probabilities, arXiv:2106.07890 / 2501.06662), so v1
  must bound novelty and the endofunctor formalism + loss-landscape↔manifold bridge
  are deferred. **Exit criterion:** a Closing Bell — a human read-cold study plus
  the automated eval ([llm_manifold/evals/](../../llm_manifold/evals/)): section,
  IEEE-citation, and pandoc checks (run red today) + an LLM judge over the claim
  ledger. **Feature-steps:** (1) finalize the outline + claim-ledger contract;
  (2..N-2) per-section prose (parallel after step 1); (N-1) holistic review +
  pin the one sharp agentic claim; (N) bibliography pass. **Blocked-on:** the
  standalone/ad-hoc eval feature (tracked in the `ailly_two` repo) to run the eval
  over a static `.md` without a hand-built conversation bridge; and the `ailly` CLI
  is not shipped in this repo (build-phase wiring). The sibling HyDE lit review
  stays a separate deliverable in `ailly_two`; cite it lightly. Session:
  [.ailly/developer/2026-06-25-C-manifold](2026-06-25-C-manifold).

- **folder-style posts: support `posts/[id]/post.md` alongside `posts/[id].md`** —
  [src/lib/posts.ts](../../src/lib/posts.ts) reads posts with `readdirSync(posts)`
  + `readFileSync(posts/[id].md)`, so it only handles flat single-file posts. A
  post that needs colocated assets (e.g. [posts/llm_manifold/post.md](../../posts/llm_manifold/post.md),
  the manifold post's home) is a **directory**, which today breaks both
  `getSortedPosts` (`readFileSync` on a dir throws `EISDIR`) and `getPost` (reads
  `llm_manifold.md`, `ENOENT`). Teach the loader the folder form: an entry that is
  a directory containing `post.md` is a post whose id is the directory name and
  whose body+frontmatter come from `post.md`, so assets can sit beside it. Update
  `getPostPaths` / `getSortedPosts` / `getPost`, the `migration.feature.test.ts`
  expectation (`docs/blog/<id>/index.html` per post), and `posts.test.ts`. Decide
  precedence if both `posts/[id].md` and `posts/[id]/post.md` exist (error vs
  folder-wins). **Trigger:** any post needs colocated assets / a folder home — the
  manifold post already does, and `posts/llm_manifold/post.md` will not render until
  this lands.

- **Astrolabe FCC refactor — run the Closing Bell.** All features are built and all
  199 tests pass (`mise exec -- npx vitest run --no-file-parallelism`); the live page
  renders clean (visual check, zero console errors). **Feature 5**
  (`feature-5/plan.md`, design `dial-redesign.md`) is the foundational dial rework that
  **superseded Feature 4**: the dial is now an `AstrolabeView` **FCC** whose boundary IS
  `<svg id="dial">`, building its subsystem FCCs once into `[State]` and fanning `Scene`
  slices on `update({ scene })`; it owns its mode class on its own boundary and each
  visibility leaf (Spokes/Hands/SunCenter, plus SunDisc) owns its own show/hide. The
  **DOM-handle seam is deleted** — `DialHandles`/`OverlayHandles`/`Dial()`/the free
  `astrolabeView`/the Feature-4 `Visibility`/`DialRoot` carriers are all gone. The
  single `#stage-wrap` component (evolved `ControlsDrawer`) owns dial + overlays
  (`Tooltip`/`SignCard`/`Clock` FCCs) + controls, taking **reference-gated merged
  payloads**: `{ state, events }` (controller) and `{ scene, dialEvents }` (60fps loop).
  Dial pointer maps ride the `viewEvents` prop (NOT `events`, which would wire the svg
  boundary); the per-child `hitEvents`/`signEvents` forwarding stays as the honored
  non-bubbling-hover exception. The only thing held across a boundary is the root
  component instance. The production SSG `.update`-graft path stays green
  (`frame-roundtrip.feature.test.ts`). Next:
  the **human-run Closing Bell** parity study at
  `.ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/closing-bell.md` (compare the
  refactored `/astrolabe/` side-by-side with `main`). After it passes, run
  `developer:cleanup` for the project-cleanup pass (flip design doc to
  `completed: <date>`, squash-merge behind human approval).

## Deferred decisions (from the project)

- **#zhits z-order / hit priority (parity nuance, low).** The Zodiac FCC nests `#zhits`
  inside `#zodiac` (`components.ts`), which paints before `#discs`; `main` appended
  `#zhits` at the SVG root so it painted last. On overlap, body hit-targets now win
  over zodiac sign hits instead of the reverse. The only physical overlap is Neptune's
  dot (orbit r≈405) grazing the sign-hit band (ZHIT_IN=410) — a thin rim sliver.
  Judged negligible and accepted. If the Closing Bell flags it, the minimal fix is to
  append `#zhits` as the last child of the `#dial` svg root (mirroring main).

- **Flaky build-race in the test suite (test infra, pre-existing).** Both
  `astrolabe.feature.test.ts` and `migration.feature.test.ts` spawn `npm run build` in
  `beforeAll`, writing to `docs/` concurrently; under vitest file-parallelism they can
  clobber each other and one intermittently reads half-written output. Workaround:
  `--no-file-parallelism`. Predates this branch (both tests exist on `main`). Worth a
  proper fix (per-test build output dir, or a single shared build fixture) so
  `npm run test` / CI is deterministic.

- **`sizeDial` host sizing (Feature 1 plan choice, settled).** `client.ts` writes the
  `<svg>` host width/height + `--dial-px` on the document root; kept out of the
  no-raw-dom guard scope as page-lifecycle wiring (per design Deferred decisions).
