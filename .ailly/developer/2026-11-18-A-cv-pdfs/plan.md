# Implementation Plan: one source for the resume and the CV, printed to PDF in CI


**Feature test:** `pages/cv/resume-and-cv.feature.test.ts`
**User story:** A hiring reader gets a resume and an academic CV generated from one `src/resume.toml`, each saved as `david_souther_resume.pdf` / `david_souther_cv.pdf` from CI.
**Libraries & Skills:** every step loads `jiffies-css-semantic-html`, `jiffies-css-theming` and `playwright-cli` (paths in design.md) while implementing.
**Run tests with:** `SKIP_SITE_BUILD=1 npx vitest run <file>`; `npm run check` is typecheck + biome. Plain `node` works (v22).
**Steps:**
- [ ] Step 0: API surface area
- [ ] Step 1: Shared-data markers (`cvSection`, tags, Smith College)
- [ ] Step 2: `[cv]` table replaces `[academic]`; cvMarkdown sections
- [ ] Step 3: Publication groups from tags and post ids
- [ ] Step 4: build-pdfs tagged/outlined output and failure behaviour
- [ ] Step 5: CI action order, docs, TASKS, feature test green

Reuse the branch code; do not start over. Each step ends with `npm run check` clean and the existing tests (`pages/cv/cv-print.feature.test.ts`, `src/migration.feature.test.ts`, `scripts/ci-workflow.feature.test.ts`) green. The feature test's first `it` goes green at the end of Step 3, the PDF `it` at Step 4 (needs `npm run build:site` for `docs/`, and Chromium).

## Step 0: API surface area

Stubs only. Patterns: plain data types plus pure functions (no new classes).

```ts
// src/lib/resume.d.ts
export type CvSection = "teaching" | "professional";
export interface JobExperience { /* existing */ cvSection?: CvSection }   // legal on jobs under MAC
export interface Tags extends Array<string> {}  // currently `{}`; artifacts carry string[]
export interface CvData {
  website?: string; note?: string; footer?: string;
  interests?: { title: string; body: string }[];
  competencies?: { label: string; items: string }[];
  publications?: CvPublicationGroup[];
}
export type CvPublicationGroup =
  | { heading: string; tag: string; posts?: never }
  | { heading: string; posts: string[]; tag?: never };
// ResumeData: replace `academic?: AcademicData` with `cv?: CvData`. Delete AcademicData, CvEntry.

// src/lib/cv.ts
export type PostRef = Pick<Post, "id" | "title" | "date" | "summary" | "show">; // from posts.ts
export function cvMarkdown(resume: ResumeData, posts?: PostRef[]): string;
export function jobsIn(resume: ResumeData, section: CvSection): JobExperience[]; // newest first
export function publicationGroups(resume: ResumeData, posts: PostRef[]): { heading: string; blocks: string[] }[];
export function monthYear(date: string): string;  // kept
```

## Step 1: Shared-data markers

**Enables:** "Every job's organization appears on the CV" and the teaching/professional split (data side).

Additive only; `[academic]` stays for now so nothing breaks. In `src/resume.toml`:
- `cvSection = "teaching"` on the `[[experience.jobs]]` entries whose organization is `Code Fellows` (line ~229), `Chatham University` (~430) and `Mt Holyoke College & Google` (~491), placed right after the `[[experience.jobs]]` line, before `[experience.jobs.organization]`. Google Shopping and Third Cat, LLC get no key.
- `tags` on `[[experience.publicArtifacts]]`: `"Industry Writing"` on "Cloud Journeys..." (~line 848), `"Curriculum"` on "Technical Whiteboarding" (~862), `"Community"` on the two non-commented Stack Overflow posts ("Is stat() an expensive system call?", "Format Date time in AngularJS") and on the three "Top 5%/10%/20% at Stack Overflow answers" achievements. Keep `"Defensive Publication"` as is (~878). Check `hide`/`show()` on any of these in the resume page so tags do not change the resume.
- "Smith University" to "Smith College" in the Mt Holyoke role text (~504).
- `resume.d.ts`: add `CvSection`, `cvSection?`, make `Tags` a string array.

**Tests** (new `src/lib/resume-data.test.ts`, parses the real TOML with `smol-toml`):

```ts
test("teaching jobs are marked", () => {
  const marked = jobs.filter(j => j.cvSection === "teaching").map(j => j.organization.name)
  assert marked equals ["Code Fellows","Chatham University","Mt Holyoke College & Google"] (as a set)
})
```
- Every `cvSection` value is `teaching` or `professional`.
- No "Smith University" anywhere in the TOML.
- Each of the four tags is on the expected artifact titles; a tag-only artifact filter returns nothing unexpected.

**Implementation outline:** edit TOML and `.d.ts` only. Proof: `SKIP_SITE_BUILD=1 npx vitest run src/lib/resume-data.test.ts && npm run check`.

## Step 2: `[cv]` table replaces `[academic]`; reworked cvMarkdown

**Enables:** first half of the feature test: Code Fellows once on the CV under "Teaching Appointments", absent from "Professional Appointments", every organization present, `[[cv.interests]]` titles on the CV and not on the resume.

`src/resume.toml`: replace `[academic]` (line ~1098 to end) with `[cv]`: keep `website`, `note` (must keep "Draft CV"), `footer`, move `[[academic.interests]]` to `[[cv.interests]]` and `[[academic.competencies]]` to `[[cv.competencies]]`. Delete `academic.teaching`, `curriculum`, `mentorship`, `software`, `service`, `talks`, `publications` (the Step 3 groups replace publications; until then no Publications section prints, which is acceptable at this step). Target roughly 60 lines.

`src/lib/cv.ts`: rework `cvMarkdown` to the design's section table: header (profile + `cv.website` + GitHub), no-print note, "Research and Teaching Interests", "Education" (all studies), "Teaching Appointments" (`jobsIn(..., "teaching")`), "Professional Appointments" (jobs without the key or `"professional"`), "Software and Open Source" from `experience.projects` (name, description, URL; reuse `plainTitle`/`monthYear`), "Technical Competencies", footer. Jobs are newest first by role `startDate` (keep the input order if already newest first; assert it). The CV has no `show()` cutoff. Delete the `entry()` helper and the old section list. Keep `plainTitle` and `monthYear`.

**Tests** (replace `src/lib/cv.test.ts`; keep its still-valid cases for dates, contact header, link stripping, no-print note, empty-section omission):

```ts
test("each job lands in exactly one section", () => {
  md <- cvMarkdown(fixture)   // small fixture: one teaching job, one professional job
  assert section(md,"Teaching Appointments") contains "Code Fellows"
  assert section(md,"Professional Appointments") not contains "Code Fellows"
})
```
- Job without `cvSection` is professional.
- Teaching and professional jobs are each newest first.
- Interests section present from `cv.interests`; Education lists unfinished studies; projects section from `experience.projects`; no `cv` table does not throw.
- Output has no "Smith University".

**Implementation outline:** build `header`, then `[heading, blocks][]` and join as today (`---` rule before each `## `). Update `pages/cv/page.ts` only if signature needs it. Proof: `SKIP_SITE_BUILD=1 npx vitest run src/lib/cv.test.ts pages/cv/cv-print.feature.test.ts && npm run check`.

## Step 3: Publication groups from tags and post ids

**Enables:** "Publications and Public Scholarship" content with no copied essay text; feature test's first `it` fully green.

Add `[[cv.publications]]` to the TOML, in this order: `Defensive Publication` (`tag`), `Industry Writing` (`tag`), `Curriculum` (`tag`), then `posts` groups: `Computing Education` = interview_01_whiteboard, interview_02_drawing, interview_03_tracing, interview_04_forward_backward, interview_06_glossary, forward_backward_method, ilities, behavioral_interviewing; `Large Language Models` = jeopardy_search, ailly_ooda, llm_review_is_not_human_review, knowledge_that_by_of, fuzzy_homomorphic_endofunctor; `Software Architecture` = arrow_of_maturity, fielding-rest; then `Community` (`tag`). Confirm each id exists under `posts/` (file or `<id>/post.md`) and read dates from `src/lib/posts.ts` `getSortedPosts()`.

`publicationGroups` renders: `tag` group = the non-`hide` artifacts carrying the tag, as title (linked to `details.URL` when present) plus `publishingDate` year plus the description's first paragraph; `posts` group = per id `Souther, D. "[title](/blog/<id>)." <year>. <summary>` from front matter, in listed order. Artifacts in no group go to a final "Other Publications" group (type `post`/`achievement`, not hidden). An unknown post id throws `Error("cv.publications: unknown post id <id>")`. A post with `show: false` is skipped, not an error. `cvMarkdown(resume, posts)` emits `### heading` per group under the `## Publications and Public Scholarship` section; `pages/cv/page.ts` passes `getSortedPosts()`.

**Tests** (`src/lib/cv.test.ts`, posts injected as plain `PostRef[]`, so no filesystem):

```ts
test("a posts group renders from front matter, in order", () => {
  md <- cvMarkdown(withGroup({heading:"Essays", posts:["b","a"]}), [postA, postB])
  assert md indexOf postB.title < md indexOf postA.title
  assert md contains "(/blog/b)"
})
```
- Tag group pulls only tagged, non-hidden artifacts.
- An artifact with no group appears under "Other Publications".
- Unknown post id throws.
- Hidden post (`show: false`) is skipped.
- Real-data check (in `resume-data.test.ts`): every `posts` id in the real TOML resolves against `getSortedPosts()`.

**Implementation outline:** index artifacts by tag, posts by id; map groups to blocks; collect leftovers. Proof: `SKIP_SITE_BUILD=1 npx vitest run src/lib/cv.test.ts src/lib/resume-data.test.ts pages/cv/resume-and-cv.feature.test.ts` (PDF `it` skips or fails without `docs/`; the first `it` must pass) and `npm run check`.

## Step 4: build-pdfs tagged/outlined output and failure behaviour

**Enables:** the feature test's PDF `it`: non-empty `%PDF-`, `/Outlines`, `/StructTreeRoot`.

`scripts/build-pdfs.ts` (exists): add `tagged: true, outline: true` to `page.pdf()`. Capture `const res = await page.goto(...)` and throw `${route} answered ${status}` unless `res?.ok()`. After each print, verify the file: exists, size > 0, first five bytes `%PDF-`, else throw naming the file. Keep the `try/finally` so the browser and server close first. Export a pure `verifyPdf(path): void` and `assertOk(route, status): void` so they test without Chromium. Keep `CHROMIUM_PATH` and the `import.meta.main` exit-1 wrapper.

**Tests** (new `scripts/build-pdfs.test.ts`, temp dir, no browser):

```ts
test("verifyPdf rejects an empty file", () => {
  writeFileSync(tmp, "")
  assert throws /empty/ from verifyPdf(tmp)
})
```
- Missing file throws; a file not starting with `%PDF-` throws; a valid `%PDF-1.7` stub passes.
- `assertOk("/cv/", 404)` throws; 200 passes; 301 handling follows `ok()`.
- Optional (only when Chromium present): `buildPdfs` against a `docs/` temp root with a 404 route rejects and leaves no server listening.

**Implementation outline:** helpers plus the loop above. Proof: `SKIP_SITE_BUILD=1 npx vitest run scripts/build-pdfs.test.ts`, then `npm run build:site && SKIP_SITE_BUILD=1 npx vitest run pages/cv/resume-and-cv.feature.test.ts` with `CHROMIUM_PATH` set if needed. Manual: page count of the CV PDF (old CV about 6 pages) and `playwright-cli` print screenshots of `/cv/` and `/` served by `node scripts/serve.ts --port 8080` from `docs/` (reuse a running server).

## Step 5: CI ordering, docs, deferred tasks, final run

**Enables:** the whole story in CI: PDFs in `docs/` before the `site-<tree>` upload, a failure blocking deploy.

- `.github/actions/build-site/action.yml` already runs `npm run check && npm run build:site`, then `npx playwright install --with-deps chromium`, then `npm run pdfs`. Verify that order and that nothing else (ci.yml `Test site`, upload-artifact) runs before the PDF step; adjust the comment. Do not make the step `continue-on-error` (design disposition 2).
- `scripts/ci-workflow.feature.test.ts` keeps its order assertions (build, chromium install, pdfs); add one asserting the pdfs step has no `continue-on-error` and sits before the end of the action.
- Docs: grep README.md, ARCHITECTURE.md, DESIGN.md for CV or PDF mentions (none found at plan time besides AGENTS-style notes); if none, add one short ARCHITECTURE.md paragraph: `/cv` is generated from `src/resume.toml` plus the `[cv]` table, PDFs are printed by `scripts/build-pdfs.ts` in the build-site action. Note the old `/resume.pdf` and `/David_Souther_CV.pdf` URLs now 404 (`public/` holds no committed CV PDFs; confirm `git ls-files | grep -i pdf` shows only `public/nix_study_guide.pdf`).
- Create `TASKS.md` (does not exist yet) with deferred entries from design (c): Curriculum Development section; Mentorship and Advising; Invited Talks and Presentations; Service; Manuscripts in Preparation (`llm_manifold` is `show: false`); NVD3 and JEFRi as `experience.projects`; the synthesized "ProTech" and "Google internal instruction" teaching entries; grouping AWS and Google teams under one employer heading; one voice across shared text; reconciling education descriptions. Also: guard against duplicated prose in any entry (intent review Q3), competencies shareable with the resume (Q1), Code Fellows NPS "at 100" vs old "above 80" (confirm), `cv.note` still names SUNY Downstate.
- Final: `npm run check`, `npm run build:site`, `npm run pdfs`, `SKIP_SITE_BUILD=1 npx vitest run` for the full suite. Both `it`s of the feature test pass.

**Tests:** the CI-workflow assertion above; the rest is the feature test.
