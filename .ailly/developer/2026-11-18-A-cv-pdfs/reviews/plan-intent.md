# Plan intent review

Open questions. Resolved and closed once the human answers. Never clears a gate.

## Posed by the cold intent reviewer (2026-11-18), Plan phase: Plan scope

Anchor: `prompt.md` (verbatim request plus follow-ups). Artifact: `plan.md`. Read alongside `design.md`, `research.md`, `reviews/design-intent.md`, `reviews/research-intent.md`.

Dedup: not re-raised because already settled or open in earlier dispositions: Code Fellows once under teaching, per-view selection rules, tagged/outline PDFs, PDF failure blocking deploy, old PDF URLs 404, NPS wording, `cv.note` wording, dropped academic sections, competencies CV-only, Code Fellows-only reuse guard, PDFs published in `docs/`.

**1. Category: Plan scope. Docs and TASKS.md are new work.** As planned, Step 5 creates a new root `TASKS.md`, adds an `ARCHITECTURE.md` paragraph, and adds a new CI-workflow assertion. The original request asked only to build the two PDFs in CI and add a `/cv` route reusing the same data. Is adding those files and test what you intended?
Answer: (pending)

**2. Category: Plan scope. Building on the closed PR's code.** As planned, "Reuse the branch code; do not start over": every step edits the commits from the PR you asked to close (`cv.ts`, `build-pdfs.ts`, `[academic]`). The follow-up said "Close the PR. Rerun the prompt using Ailly's quickloop process so it's got actual design." Is it intended that the new work starts from the closed PR's branch rather than from the base branch?
Answer: (pending)

**3. Category: Plan scope. Stack Overflow content as scholarship.** As planned, Step 1/3 tags the two Stack Overflow answers and the three "Top 5%/10%/20%" achievements `Community`, and the CV prints them as a "Community" group under "Publications and Public Scholarship". The request asked for a CV "rearranged for academic focus". Is it intended that Stack Overflow answers and rankings appear in the academic publications section?
Answer: (pending)

**4. Category: Plan scope. Essay groups are hand-picked in the TOML.** As planned, Step 3 fixes three essay groups (Computing Education, Large Language Models, Software Architecture) as hard-coded post-id lists in `[[cv.publications]]`, so a new post never reaches the CV unless the TOML is edited. The request asked that the CV use "the same data" with maximum reuse. Is a curated id list (versus deriving from post tags or front matter) what you intended?
Answer: (pending)

**5. Category: Plan scope. Nothing links to the PDFs.** As planned, the PDFs only exist as files in `docs/`; no step adds a download link on `/` or `/cv`. The correction said the names should be distinct "when people save them". Is it intended that people find the files by URL only, with no link on the site?
Answer: (pending)

**6. Category: Plan scope. Interim CV loses publications.** As planned, after Step 2 the CV has no Publications section until Step 3, because `academic.publications` is deleted first. The request wanted a CV that reuses existing content. Is it acceptable that the two steps land as separate commits in that order, or should publications never be absent from a committed state?
Answer: (pending)

## Factual checks against the repo

All 15 post ids named in Step 3 exist under `posts/` and none has `show: false`. The TOML anchors in Step 1 (Code Fellows ~229, Chatham ~430, Mt Holyoke ~491, "Smith University" line 504, tag lines, the two Stack Overflow posts and three achievements) match. `TASKS.md` does not exist (as stated), and no committed CV PDFs remain (`git ls-files` shows only `public/nix_study_guide.pdf`). No factual error found, only a note: Plan says "Plain node works (v22)" while `package.json` engines and AGENTS.md require Node >=24 via mise; the sandbox has v22.23.5.

## Quick-loop dispositions (2026-11-18, coordinator)

1. TASKS.md, the ARCHITECTURE.md note and the CI assertion stay: TASKS.md is the Ailly convention for deferred work, and the other two document and guard the feature. Status: default applied.
2. Building on the closed PR's commits: kept. The final diff against main is what ships; the earlier commits stay in branch history. Status: **open for the user** (squash or restart if preferred).
3. Community tagging of the Stack Overflow achievements under Publications: kept as planned, revisit freely. Status: **open for the user**.
4. Curated post-id lists in `[[cv.publications]]`: kept. An academic CV is curated; new posts do not reach it automatically. Status: default applied.
5. No link to the PDFs on `/` or `/cv`: out of scope here, readers find them by URL. Status: **open for the user**.
6. Step 2 and Step 3 land as separate commits in that order. Status: default applied.
