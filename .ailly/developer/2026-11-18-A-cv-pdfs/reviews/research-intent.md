# Research intent review

Open questions. Resolved and closed once the human answers. Never clears a gate.

## Posed by the cold intent reviewer (2026-11-18), Research-phase variant: blind spots

Anchor: `prompt.md` (verbatim request plus three follow-ups). Artifact: `research.md`.

**1. Category: Research gap. Smallest version drops academic sections.** As researched, the "smallest version that still meets the intent" has no separate Curriculum, Mentorship, Talks or Service sections, and "new CV content beyond what the old CV held" is out of scope. The request asked for a `/cv` "rearranged for academic focus" that reuses "as much content as possible". Is it intended that an academic CV may lose those academic-looking sections rather than derive them from shared job text?
Answer: (pending)

**2. Category: Research gap. The "we might already have this?" question.** As researched, an existing hand-written CV (`pages/cv`, `content/cv-suny-downstate.md`, committed PDFs) is treated as a baseline to be mined and then removed, and no Resolved Decision answers the request's parenthetical directly. The request asked "we might already have this?" about a dedicated `/cv` route. Is replacing the existing CV (and deleting its Markdown source) what you intended, or should some of it stay authoritative?
Answer: (pending)

**3. Category: Research gap. Resume PDF is invisible.** As researched, nearly all analysis centres on the CV. The resume PDF is covered only by "Redesigning the resume's look" being out of scope and by the output filename. The request asked for `resume.pdf` and `cv.pdf` both built in CI. Inside the frame we have built, what has orienting on the CV made invisible about the resume PDF (page length, print-hidden entries, link rendering, whether the current resume print layout is acceptable as a standalone download)?
Answer: (pending)

**4. Category: Design assumption. Each job in exactly one CV section.** As researched, design space item 1 puts each job in exactly one CV section (teaching jobs only under teaching, others only under professional). The request said "the CodeFellows role applies to both" (resume and CV) and wants maximum reuse. Is it intended that a role like Code Fellows appears once in the CV, rather than also under professional appointments, as academic CVs often do?
Answer: (pending)

**5. Category: Research gap. Goal says all roles in both views, code hides some.** As researched, the Goal states "every role, study and artifact is written once and appears in both views". The codebase hides jobs that ended before 2018 and unfinished studies from the resume's print via `no-print`. The request asked for the CV to use "the same data" and the resume PDF to be built, without saying the resume should now print old jobs. Is it intended that the CV shows jobs the resume currently hides, or that the two views share the same hiding rules?
Answer: (pending)

**6. Category: Research gap. Depth of process.** As researched, this is a full-fidelity Research artifact (12 sources, a falsification pass, and about ten open design items). The request began "quickloop" and the follow-up asked to "rerun the prompt using Ailly's quickloop process so it's got actual design". Is this level of open-question breadth what you intended, or should several of the open items (PDF tagging and outline, print-time font dependencies, old-URL 404s) be defaulted conservatively instead of passed to design?
Answer: (pending)

## Quick-loop dispositions (2026-11-18, coordinator)

Auto-cleared gates do not wait for answers, so each question carries a conservative default for design. Overturn any of these at the review pause.

1. Sections without a source in the shared data (Curriculum, Mentorship, Talks, Service) are not re-authored as duplicate text. They are derived from tagged shared entries where a source exists, otherwise dropped and recorded as deferred tasks. Status: **open for the user**.
2. "We might already have this?": yes, `/cv` existed as hand-written Markdown. It is replaced by a render of the shared data; the Markdown stays in git history. Status: **open for the user**.
3. The resume PDF gets the same acceptance as the CV PDF: both exist, are non-empty, and print from the built site. Redesigning the resume print layout is out of scope. Status: default applied.
4. Code Fellows is authored once and appears in the resume and once in the CV, under teaching. Per the user's own example. Status: default applied.
5. Each view owns its selection rule. The resume keeps its `show()` cutoff; the CV is complete and shows every job. Status: default applied.
6. Conservative defaults taken: PDF tagging and outline on; fonts and unpkg dependencies unchanged; old PDF URLs not preserved; NPS wording left as the shared TOML text and flagged; "Smith University" corrected to "Smith College". Status: **open for the user** (NPS, URLs).
