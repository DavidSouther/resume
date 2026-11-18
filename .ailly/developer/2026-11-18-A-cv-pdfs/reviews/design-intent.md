# Design intent review

Open questions. Resolved and closed once the human answers. Never clears a gate.

## Posed by the cold intent reviewer (2026-11-18), Design phase: Design assumption

Anchor: `prompt.md` (verbatim request plus three follow-ups). Artifacts: `design.md`, `pages/cv/resume-and-cv.feature.test.ts`. Read alongside `research.md` and `reviews/research-intent.md`.

Dedup: candidates already settled by the quick-loop dispositions (Code Fellows once under teaching, per-view selection rules, resume PDF parity, tagged/outline PDFs, Smith College fix) or already listed in the design's Open Artifact Decisions (NPS wording, old PDF URLs, `cv.note` wording, section headings, replacing the hand-written CV, dropped academic sections) were not re-raised.

**1. Category: Design assumption. CV-only table is wider than the interests.** As designed, the `[cv]` table holds interests, note, footer, Technical Competencies groups and the publication groupings, so the CV prints competency groups the resume data does not carry and the resume never shows them. The original request said "The academic interests are truly unique to the CV" and the "resume and cv should reuse as much content as possible". Is it intended that competencies and publication groupings are also CV-only, rather than shared (for example from `knowledge.hardSkills` and the artifact tags the resume already reads)?
Answer: (pending)

**2. Category: Design assumption. A PDF failure blocks deploy.** As designed, `scripts/build-pdfs.ts` exits non-zero on any non-2xx route or missing, empty or non-PDF output, and the step lives in the shared `build-site` action, so a Chromium download flake or a Google Fonts or unpkg outage fails CI and blocks the whole site deploy. The original request asked to "build resume.pdf and cv.pdf during CI" and did not say the PDFs should gate publishing the site. Is that what you intended, or should a PDF failure be reported without blocking the site?
Answer: (pending)

**3. Category: Design assumption. "Reuse" is enforced for one role.** As designed, the feature test proves reuse only for the Code Fellows role (once on the resume, once on the CV, same TOML text). The "zero duplicated prose" metric for every other role, study and artifact is left to a manual reviewer search. The follow-up asked that "the resume and cv should reuse as much content as possible", with Code Fellows only as an "example". Is a Code Fellows-only automated check what you intended, or should the feature test guard that no entry's text can be authored twice?
Answer: (pending)

**4. Category: Design assumption. PDFs ship on the public site.** As designed, both PDFs are written into `docs/`, deployed at the site root, and the committed PDFs under `public/` are removed. The original request said only to "build resume.pdf and cv.pdf during CI" (corrected to the `david_souther_*` names so they are distinct when saved). Is it intended that they are published as public site files, rather than only attached as CI or release artifacts?
Answer: (pending)

## Notes for the coordinator

- No question above invalidates the feature test if answered the other way. Question 3 would extend it. Question 2 changes only the script's failure policy, which the feature test exercises only on the success path.
- The feature test does depend on two default-applied dispositions that are not marked open for the user: the teaching/professional split (Code Fellows absent from "Professional Appointments") and PDF `/Outlines` plus `/StructTreeRoot`. If the human overturns either at the review pause, the matching assertions must be rewritten.
- The PDF half of the test is `skipIf` no Chromium, so a local run without a browser passes without testing printing. In CI the browser is installed by the action before the `Test site` step, so it runs there.

## Quick-loop dispositions (2026-11-18, coordinator)

1. Competencies and groupings in `[cv]`: kept CV-only for now because `knowledge.hardSkills` is empty in the TOML and has no grouping. Sharing them is a follow-up if the user wants them on the resume. Status: **open for the user**.
2. PDF failures fail the build: kept. A missing or empty PDF must never publish silently, and PR CI shows the failure before merge. Status: default applied.
3. Reuse is guarded for Code Fellows only in the feature test. A guard against any duplicated prose is deferred. Status: **open for the user**.
4. PDFs publish at the site root in `docs/`, since the user asked for them by download names. Status: default applied.
