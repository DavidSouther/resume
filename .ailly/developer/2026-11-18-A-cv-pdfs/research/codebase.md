# codebase — resume/CV single source (specific lens)

*2026-11-18. Read against `origin/main` (053a9f3) unless marked "branch" (claude/laughing-bell-1o0qfy, closed PR).*

## How the resume renders and selects today

- `/` = `pages/page.ts:9-13` → `tomlLoader()` (`src/lib/loader.ts:6-13`, smol-toml parse, cast to `ResumeData`, no validation) → `Home()` (`src/components/home.ts:11-34`) → `Resume()` (`src/components/resume/resume.ts:18-81`).
- Selection is render-side only, three rules:
  1. `show()` (`src/lib/util.ts:1-8`): a job whose last role finished before 2018 gets class `no-print` (`src/components/resume/job-detail.ts:17-18`). Screen shows all jobs; print hides pre-2018. Name is inverted (returns true = show).
  2. Studies with `degreeAchieved = false` are `no-print` (`src/components/resume/studies.ts:6-7`).
  3. Publications: only artifacts with a `URL` (`resume.ts:23-25`), `hide !== true` (`resume.ts:72`), sorted by `publishingDate` desc.
- `resume.d.ts` already carries non-MAC extension fields `full?` (lines 27,34,44,96,156) and `hide?` (43); none are set in `src/resume.toml`. So the typed model already tolerates per-view flags.
- Role names carry levels.fyi Markdown links (`src/resume.toml:39,70,107,148,177,289,326,372,456`) rendered with `no-print-href` (`job-detail.ts:29`).
- `/cv` on main = `pages/cv/page.ts` → `MD(readFileSync("content/cv-suny-downstate.md"))` with class `cv no-print-href`. Print CSS `.cv` lives at `src/global.css:514-640` (`@page` at 522), asserted by `pages/cv/cv-print.feature.test.ts` (11 cases, lines 111-227) that target Markdown markup (h1/h2/h3/p/li/hr under `.cv`).
- Old PDFs on main: `public/resume.pdf`, `public/David_Souther_CV.pdf` (hand-made). No in-repo link to either (only a CSS comment, `src/global.css:559`); inbound links are external. `docs/` is gitignored (`.gitignore:24`).

## MAC v0.3 schema extension rules (verified against schema.json [1])

| Object | additionalProperties | Usable selector fields |
|---|---|---|
| root | true | any new top-level table (e.g. `[academic]`/`[cv]`) is legal |
| `experience` | true | — |
| `experience.jobs[]` | **true** | a per-job key (e.g. `views`, `cv`) is legal here |
| `$defs/role` | **false** | only `notes` (string), `competences[]`; adding a key breaks schema |
| `challenges[]` | false | `description`, `actions[]` |
| `publicEntityDetails` (organization, project/artifact details) | true | extra keys legal |
| `projects[]` | false | `type`, `details`, `roles` |
| `publicArtifacts[]` | false | **`tags: string[]`** (the only MAC tag field), `type` (post/talk/sideProject/achievement/launch/video), `relatedCompetences` |
| `knowledge.studies[]` | false | `linkedCompetences`, `studyType` |
| `competence` | false | `type`: tool/technology/practice/hardware/domain |
| `knowledge.hardSkills/softSkills` | false | MAC-native home for a competencies list |

Nothing in the repo validates against the schema (no ajv; only `$schema` at `src/resume.toml:1`), so it binds editor tooling only. Existing use: one artifact already has `tags = ["Defensive Publication"]` (`src/resume.toml:879`).

## Teaching/academic entries already in experience.jobs

| Job (toml line) | Ends | Printed on resume? | Old CV section |
|---|---|---|---|
| Code Fellows, Lead Instructor (229-282) | 2023 | yes | Teaching; also Curriculum (Code 401, whiteboarding), Mentorship (career coaching), Service (whiteboarding group) |
| Chatham University, Lecturer (431-449) | 2017 | no (cutoff) | Teaching |
| Mt Holyoke College & Google, Instructor (492-516) | 2017 | no | Teaching |
| Google Shopping (451-490) — text contains internal TS/Angular courses and Mt Holyoke TDD intensive | 2017 | no | Teaching "Internal instruction — Google" (synthesized), Talks |
| Third Cat LLC (518-555) — text contains ProTech trainer | 2015 | no | Teaching "ProTech via Third Cat" (synthesized) |
| AWS TCX AI Lab (143-170) — Code Explainer bullet | 2024 | yes | Curriculum (Code Explainer) |
| GCP Compute Front End (321-365) — manager promotions | 2021 | yes | Mentorship (engineering management) |
| Apollo GraphQL (65-100) — Rust mentoring | 2026 | yes | Mentorship (technical) |

So 3 pure teaching jobs + 2 jobs whose teaching content the old CV split out into its own entry + 3 jobs feeding Mentorship/Curriculum. The branch duplicated 5 teaching entries into `[[academic.teaching]]` with fresh wording (branch `src/resume.toml` diff: 5 teaching, 5 curriculum, 4 mentorship, 2 service).

## Wording conflicts between toml and old CV (must be resolved to one text)

- Code Fellows NPS: toml "at 100 net promoter score" (`src/resume.toml:245-247`) vs old CV "above an 80 net promoter score".
- Voice: toml first person ("I joined Connect…", `src/resume.toml:47`) vs old CV third-person-ish/impersonal, rewritten and polished for every role.
- "Smith University" (`src/resume.toml:504`) vs "Smith College" (old CV, correct name).
- Education descriptions: toml MS/BS Math text (`src/resume.toml:1023-1045`) vs old CV's longer versions (BS CS cluster-genome tooling story absent or different).
- Role titles: toml levels.fyi-linked level strings vs old CV prose titles ("Senior Software Development Engineer (SDE III / L6)"). Branch strips links with `plainTitle` (branch `src/lib/cv.ts:47-50`) — a render transform, not an override.
- Org names: toml splits AWS into three jobs and Google into GCP-CFE/GCP-Topology/Shopping; old CV groups by employer with sub-team italics.

## Old-CV content with no toml counterpart

- Research and Teaching Interests (4 paragraphs) — truly CV-only.
- Draft note (SUNY Downstate, screen-only) and footer "References available on request" — CV-only.
- Manuscript in preparation (LLM syntactic space) — exists as a draft post `posts/llm_manifold/post.md` (`show: false`), no toml artifact.
- Essays (14 entries in 4 groups) — every one is an existing blog post in `posts/` with `title`/`date`/`summary` front matter (e.g. `posts/ilities.md:1-5`); none is in toml. No post has a `tags` field.
- Invited talks (3) — derivable: -ilities is a post; NYT talks are in NYT job text; Mt Holyoke TDD is in Google Shopping text.
- Service (2) — Code Fellows whiteboarding (in job text), open-source maintenance (projects).
- Technical Competencies (5 labelled groups) — no MAC equivalent populated; `knowledge.hardSkills` is empty; per-role `competences` exist but are fine-grained.
- Software: NVD3 and JEFRi are absent as projects (only mentioned in Novus/Design Delegates job text).

## Old-CV content already covered by toml

- Software and Open Source: Ailly, nand2tetris/web-ide, Jiffies CSS, software_craftsmanship, Montana-News-Archive = all 5 `experience.projects` (`src/resume.toml:755-842`).
- Publications: defensive publication (876-897, tagged), Cloud Journeys (844-857), Technical Whiteboarding curriculum (858-875), Stack Overflow answers + top-% achievements (899-1015).
- Curriculum: Software Craftsmanship + nand2tetris (projects), whiteboarding (artifact), Code 401 + Code Explainer (job text).

## Branch first attempt (closed)

- `src/lib/cv.ts` builds Markdown from shared `aboutMe`/`experience.jobs`/`knowledge.studies` plus a 435-line `[academic]` table of CV-only text (`src/lib/resume.d.ts` `AcademicData`, `CvEntry`). Jobs are emitted wholesale, so teaching roles print twice on the CV (once under Teaching from `[academic.teaching]`, once under Professional Appointments from jobs).
- `scripts/build-pdfs.ts` serves `docs/` with jiffies `makeServer`, Chromium `emulateMedia print`, `page.pdf({preferCSSPageSize, printBackground:false})` for `/` and `/cv/`. Composite action runs `npx playwright install --with-deps chromium` then `npm run pdfs` after `build:site`, so CI's `site-<tree>` artifact (ci.yml) carries the PDFs and deploy.yml's reuse path ships them unchanged.
- Locally, `node` on PATH is v22.23.5; run through `mise exec --`.

## Print-time network dependencies

`src/global.css:11` `@import`s Google Fonts (Libre Baskerville, Poppins), and `src/lib/page-head.ts` loads jiffies-css from unpkg. A CI PDF depends on both being reachable; `waitUntil: "networkidle"` is the only guard.

**Sources**

[1] Manfred, "MAC schema v0.3," GitHub. https://raw.githubusercontent.com/getmanfred/mac/v0.3/schema/schema.json (accessed Nov. 18, 2026).
