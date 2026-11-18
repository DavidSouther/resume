# Build intent review

Open questions. Resolved and closed once the human answers. Never clears a gate.

## Posed by the cold intent reviewer (2026-11-18), Build phase: Implementation surprise

Anchor: `prompt.md` (verbatim request plus follow-ups). Artifact: `git diff 8ea4a4f..HEAD` on `claude/laughing-bell-1o0qfy` and the rendered output of `cvMarkdown` against the real `src/resume.toml` (all post ids stubbed). Read alongside `design.md`, `plan.md`, and `reviews/{research,design,plan}-intent.md`.

Dedup: not re-raised because already decided or deferred in the design or earlier dispositions: Code Fellows once under teaching, NPS wording (CV now prints "100", the old CV said "above 80"), competencies CV-only, Community/Stack Overflow under publications, Code Fellows-only reuse guard, PDFs published and failure-blocking, dropped sections (curriculum, mentorship, talks, service, manuscripts, NVD3/JEFRi, ProTech/Google internal), AWS/Google grouping and one voice across shared text (raw level codes and three Amazon employer names in titles), old PDF URLs.

**1. Category: Implementation surprise. A fact is authored twice inside `[cv]` and the shared data.** As implemented, `cv.interests[0]` restates the M.S. research focus ("approaches to teaching software engineering to mid-career professionals with little to no programming experience") that `knowledge.studies` also carries, and it hard-codes "Nineteen years" of engineering and "a decade of teaching" that the job dates already encode. The request said "The academic interests are truly unique to the CV" but that the resume and CV "should reuse as much content as possible". Is it intended that interest prose may re-state facts the shared entries already hold, rather than only the interpretive framing?
Answer: (pending)

**2. Category: Implementation surprise. Technical Whiteboarding prints twice on the CV.** As implemented, the CV lists the "Technical Whiteboarding" artifact (tag `Curriculum`) whose description says it is a series of posts, and under "Computing Education" it also lists five `interview_*` posts that are the same series, and the Code Fellows role text describes the whiteboarding rewrite a third time. The request used the duplicated Code Fellows teaching role as its example of what must not happen. Is it intended that the same work appears as a curriculum artifact and as separate essays?
Answer: (pending)

**3. Category: Implementation surprise. Old-CV details dropped that the design did not list.** As implemented, relative to `origin/main:content/cv-suny-downstate.md` the CV no longer prints: the first-author line and the "Full text (PDF)" link for the Defensive Publication; the locations "Pittsburgh, PA" (Chatham) and "Billings, MT" (Rocky Mountain College); and "Spring 2026" for the M.S. start (now "January 2026"). The design's deferred list names none of these. The request asked for a CV "rearranged for academic focus", not trimmed. Are these omissions intended, or should the shared entries carry them?
Answer: (pending)

**4. Category: Implementation surprise. CV "Software and Open Source" prints every `experience.projects` entry.** As implemented, it lists all five projects (Ailly, Jiffies CSS, nand2tetris web-ide, Software Craftsmanship, Montana News Archive) with a "since" date, including Montana News Archive and Jiffies CSS, which the old CV never listed, while the old CV's "Code Explainer" and curriculum framing for Software Craftsmanship and nand2tetris are gone. The request asked for an academic arrangement of the same data. Is "every project, uncurated" what you intended, versus a CV-only selection?
Answer: (pending)

**5. Category: Implementation surprise. Hidden posts vanish silently while unknown ids fail loudly.** As implemented, a `cv.publications` post id that does not exist throws and fails the build, but an id whose post has `show: false` is dropped with no message, and a group left empty disappears from the CV. The request asked only for a CV from "the same data". Is a silent drop of a curated, named essay (for example after someone hides a post) what you intended, or should it fail or warn like an unknown id?
Answer: (pending)

## Notes for the coordinator

- Questions 1 and 2 bear on the central requirement (each fact authored once) and are not covered by the feature test, which checks only Code Fellows.
- Verified by rendering: the CV has the section order in `design.md`, Code Fellows appears once, under Teaching Appointments, and "Professional Appointments" does not mention it.

## Quick-loop dispositions (2026-11-18, coordinator)

Build is green; none of these were changed, all are **open for the user** at the review pause.

1. Interest prose restates facts already in shared entries ("Nineteen years", the M.S. research focus).
2. Whiteboarding appears as a Curriculum artifact, as five interview posts, and inside the Code Fellows role text.
3. Details the old CV had that design did not list as deferred: first-author line and full-text PDF link on the defensive publication, "Pittsburgh, PA", "Billings, MT", "Spring 2026".
4. Software prints every `experience.projects` entry, uncurated, so Jiffies CSS and Montana News Archive appear.
5. A `show: false` post in `cv.publications` is dropped silently, where an unknown id fails the build.
