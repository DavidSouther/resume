# Design: one source for the resume and the CV, printed to PDF in CI


**Feature test:** `pages/cv/resume-and-cv.feature.test.ts`

> *"Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: `jiffies-css-semantic-html` (`node_modules/@davidsouther/jiffies-css/skills/jiffies-css-semantic-html/SKILL.md`), `jiffies-css-theming` (`node_modules/@davidsouther/jiffies-css/skills/jiffies-css-theming/SKILL.md`), and `playwright-cli` (`node_modules/playwright-core/lib/tools/skills/playwright-cli/SKILL.md`, the same guide AGENTS.md points at) for visual and print verification."*

## Purpose

Readers get two documents about one career. The resume (`/`) is for industry hiring. The CV (`/cv`) is for academic hiring: interests, teaching and scholarship come first, and the full record follows. Today the CV is a separate copy of the text, so the two drift apart. The closed first attempt printed the teaching roles twice, in two different wordings.

This design authors every role, study, project and artifact once, in `src/resume.toml`. Each view chooses which entries to show and in what order. Only material that exists for the CV alone lives in a small CV-only table. CI prints both views to `david_souther_resume.pdf` and `david_souther_cv.pdf`, and the release ships those files.

## Prior Art

- **Tag-and-filter** (TailorCV) and **base-plus-overlay** (EngineerCV `variants`, FluentCV merge) are the two known ways to make variants (research [4]–[6]). This design uses tag-and-filter. An overlay invites the second wording the user ruled out.
- **MAC v0.3** allows extra keys on the root, on `experience.jobs[]` and on `publicEntityDetails`. It allows none on roles, projects, artifacts or studies. Its only tag field is `publicArtifacts[].tags` [7].
- **In-repo:** the resume already hides entries per view with CSS (`show()`, `src/lib/util.ts`). The branch's `src/lib/cv.ts` already turns shared jobs into Markdown with title transforms (`plainTitle`, `monthYear`), and `scripts/build-pdfs.ts` already prints `/` and `/cv/` with Playwright. Both are kept and reworked here.
- **Printing:** Playwright `page.pdf()` with `tagged` and `outline` (since v1.42) [9]. A check in this sandbox confirmed that Chromium 1243 writes `/Outlines` and `/StructTreeRoot` when both options are set.

## User Journey and Metrics

1. A hiring reader opens `/` or `/cv` on the site, or downloads `david_souther_resume.pdf` or `david_souther_cv.pdf`. The file names stay distinct in a Downloads folder.
2. On the CV they read, in order: interests, education, teaching appointments, professional appointments, publications, software, and competencies. Code Fellows appears once, under teaching, with the same words as on the resume.
3. The author edits one entry in `src/resume.toml`, pushes, and CI rebuilds both pages and both PDFs. They cannot drift apart.

**Acceptance (the feature test):**
- The Code Fellows role text from the TOML appears exactly once on the resume and exactly once on the CV.
- On the CV it appears under "Teaching Appointments", and "Professional Appointments" does not mention Code Fellows.
- Every job's organization appears on the CV.
- Every `[[cv.interests]]` title appears on the CV and not on the resume.
- Both PDFs come out of `docs/` non-empty, as real PDFs, with an outline and tags.

**Metrics:**
- Zero duplicated role, study or artifact prose in the TOML. A reviewer can check this by searching for any entry's first sentence.
- The CV-only table stays small: interests, note, footer, competencies and publication groupings, roughly 60 lines instead of the branch's 435.
- The CI PDF step adds well under a minute (the browser download is the bulk of it, per [11]).

## Specification

### (a) Data model

- **The CV placement key is `cvSection` on `experience.jobs[]`.** It is legal there under MAC. Its values are `"teaching"` and `"professional"`; a job without the key counts as `"professional"`.
  - Code Fellows, Chatham University and Mt Holyoke College & Google get `cvSection = "teaching"`.
  - Google Shopping and Third Cat stay professional. Their teaching sentences remain inside their own role text.
  - Each job therefore lands in exactly one CV section. The resume ignores the key.
- **Artifact groups reuse `publicArtifacts[].tags`.** The defensive publication keeps its tag. Three tags are added: `"Curriculum"` (Technical Whiteboarding), `"Industry Writing"` (Cloud Journeys) and `"Community"` (the Stack Overflow entries).
  - Projects need no marker, because every project is listed under Software.
- **A small root table, `[cv]`, replaces the branch's `[academic]`.** It is legal at the root and holds only CV-only material:
  - `website`
  - `note`: the screen-only draft disclaimer. It must keep the words "Draft CV" that `cv-print.feature.test.ts` looks for.
  - `footer`
  - `[[cv.interests]]` (`title`, `body`)
  - `[[cv.competencies]]` (`label`, `items`)
  - `[[cv.publications]]`: an ordered list of publication groups. Each group has a `heading` and one source: either `tag` (the artifacts that carry it) or `posts` (an ordered list of `posts/` ids).
- **Essays come from the posts themselves.** A `posts` group is rendered from each post's own front matter (`title`, `date`, `summary`) and links to `/blog/<id>`.
  - No essay text is copied into the TOML.
  - An unknown post id fails the build.
  - The essay groups are Computing Education, Large Language Models and Software Architecture, with the same post ids as the old CV.
- **Removed:** `[academic.teaching]`, `curriculum`, `mentorship`, `software`, `service`, `talks` and `publications`, along with `AcademicData` and `CvEntry`. `resume.d.ts` gains `cvSection?` on `JobExperience` and a `CvData` type for `[cv]`.
- **Shared text fixes** (they apply to both views): "Smith University" becomes "Smith College".

### (b) How /cv renders

`/cv` stays a Markdown document built from the shared data and rendered with `MD()` under a `cv no-print-href` root. This is the reworked `cvMarkdown`.

- **Why Markdown and not the resume's components:**
  - The existing `.cv` print sheet and its 11 tests assume Markdown markup: `h1`–`h3`, `p`, `li`, `hr`, and the sections jiffdown nests.
  - Role text is already Markdown in the TOML, so both views run the same source through the same `MD()`.
  - The resume components carry resume-only print behaviour (the `show()` `no-print` cutoff, cards, `h5` role headings). That behaviour would fight the CV's "show everything" rule.
- **What is reused:** the content. The resume page is unchanged.
- **Render-side transforms only:** links are stripped from role titles (`plainTitle`) and dates are shown as month and year. No per-view text overrides exist today. One can be added later only where a fact or the voice genuinely differs, and none does now.

### (c) CV sections and their sources

| # | CV section | Source |
|---|---|---|
| 1 | Header (name, location, mail, phone, site, GitHub) | `aboutMe.profile`, plus `cv.website` |
| 2 | Draft note (screen only, `no-print`) | `cv.note` |
| 3 | Research and Teaching Interests | `cv.interests` |
| 4 | Education (all studies, including the one in progress) | `knowledge.studies` |
| 5 | Teaching Appointments | jobs with `cvSection = "teaching"`, newest first |
| 6 | Professional Appointments | all other jobs, newest first |
| 7 | Publications and Public Scholarship (`###` per group) | `cv.publications` groups. Artifacts not in any group go under a final "Other Publications" group, so nothing is dropped silently. `hide = true` is respected. |
| 8 | Software and Open Source | `experience.projects` |
| 9 | Technical Competencies | `cv.competencies` |
| 10 | Footer | `cv.footer` |

**Dropped and deferred** (each becomes a TASKS entry; the role text that held this content still prints in full under sections 5 and 6):
- Curriculum Development as its own section
- Mentorship and Advising
- Invited Talks and Presentations
- Service
- Manuscripts in Preparation (the draft post `llm_manifold` has `show: false`)
- NVD3 and JEFRi as software entries, which would mean new `experience.projects` that also reach the resume
- The synthesized "ProTech" and "Google internal instruction" teaching entries
- Grouping AWS and Google teams under one employer heading
- One voice across all shared text
- Reconciling the education descriptions

### (d) Selection rule per view

- **Resume:** unchanged. It shows every job on screen, `show()` puts `no-print` on jobs that ended before 2018, unfinished studies are `no-print`, and publications must have a URL and not be hidden.
- **CV:** the complete record. It shows every job, every study and every non-hidden artifact, with no cutoff. `cvSection` only decides which section an entry goes in.

### (e) CI and PDF step

- `.github/actions/build-site` runs `npm run check && npm run build:site`, then `npx playwright install --with-deps chromium`, then `npm run pdfs`. The browser is not cached [11].
- The PDFs land in `docs/`, so ci.yml's `site-<tree>` artifact is exactly what deploy.yml ships.
- `scripts/build-pdfs.ts` serves `docs/` and opens each route with print media emulated, waiting for `networkidle`. It then calls `page.pdf({ preferCSSPageSize: true, printBackground: false, tagged: true, outline: true })`.
  - Output files: `david_souther_resume.pdf` for `/` and `david_souther_cv.pdf` for `/cv/`.
  - `CHROMIUM_PATH` overrides the browser.
- **Failure behaviour.** The script exits non-zero, which fails CI and blocks deploy, when:
  - a route answers with anything but 2xx;
  - a PDF is missing, empty, or does not start with `%PDF-`.
  - In every case it closes the browser and the server first.
- The fonts (Google Fonts) and jiffies-css (unpkg) remain network dependencies. That is accepted.
- `scripts/ci-workflow.feature.test.ts` keeps its step-order assertions. A unit test covers the missing/empty failure path.

### Existing tests

- `pages/cv/cv-print.feature.test.ts` stays as it is.
- `src/lib/cv.test.ts` is replaced by unit tests of the new section and selection rules.
- `src/migration.feature.test.ts` is unaffected.

### Verification

- **Automated:** the feature test, plus `npm run check`.
- **Manual:**
  - Take a `playwright-cli` print screenshot of `/cv/` and `/`, served from `docs/`.
  - Open both PDFs and check the page count (the old CV was about 6 pages), the outline sidebar, and that no URLs are trailed after links.

## Alternatives

Forward from the branch: `cv.ts` (Markdown builder and transforms), `build-pdfs.ts`, the action steps, and the bloated `[academic]` table already exist. Backward from the goal: two PDFs come from two routes, which come from a selection over shared entries, which needs one placement key and a small CV-only table. The two frontiers meet at "replace the `[academic]` entry lists with selectors and keep only interests, note, footer and competencies". The hard steps are the publication groupings and deciding what to drop.

1. **Selectors over shared data, CV as Markdown (recommended).**
   - Pros: the smallest change from the branch, it keeps the print sheet and its 11 tests, and each fact has exactly one home.
   - Cons: two renderers (DOM for the resume, Markdown for the CV) produce the same data in different markup.
2. **CV built from the resume's DOM components** (`JobDetail`, `Education`, `Pub`), arranged differently inside `.cv`.
   - Pros: the most code reuse.
   - Cons: the components bake in resume print rules (the `show()` cutoff would hide pre-2018 jobs on the CV PDF) and card and `h5` markup. The `.cv` print sheet and its tests would have to be rewritten, and the components parameterized per view. More churn for no gain in content reuse.
3. **Base plus overlay**: the CV table overrides or extends entries by name.
   - Pros: room for wording that differs per view.
   - Cons: MAC forbids keys on roles, so overrides have to match entries by name or index, which is fragile. It also reopens the door to the duplicate wording the user rejected.

Off-the-shelf tools (resume-cli, RenderCV, HackMyResume) do not read MAC TOML and do not render into this SSG; Typst, pandoc and WeasyPrint would mean a second template. All of these are out of scope.

## Summary

Recommended: approach 1. Every entry is written once in `src/resume.toml`. A `cvSection` key on each job and the existing artifact `tags` place entries in CV sections. A small `[cv]` table holds the interests, note, footer, competencies and publication groupings, with essays referenced by post id. `/cv` is generated Markdown under the existing print sheet. The build-site action prints both pages to tagged, outlined PDFs and fails if either is missing or empty. Deferred work is listed in (c).

### Open Artifact Decisions

- **`cvSection` on `experience.jobs[]`:** the key's name and values. Options: `cvSection = "teaching" | "professional"`, a list `views = ["resume","cv"]`, or `cv = { section = "teaching" }`.
  Proposed: `cvSection`, with "professional" when absent. The feature test reads only the section headings, not the key.
- **Root table name `[cv]`:** options are `[cv]` or the branch's `[academic]`.
  Proposed: `[cv]`. It names the view, not the content. The feature test reads `cv.interests`.
- **`[[cv.publications]]` shape:** an ordered list of groups, each with `heading` and either `tag` or `posts`. The alternative is separate `essays` and `tagGroups` lists.
  Proposed: the single ordered list, so publication order is controlled in one place.
- **New artifact tags** `"Curriculum"`, `"Industry Writing"` and `"Community"`.
  Proposed: as listed, matching the old CV's group headings.
- **Section headings** "Teaching Appointments" and "Professional Appointments" (the feature test matches these).
  Proposed: as written. They replace the old "Academic and Teaching Appointments".
- **Code Fellows NPS wording:** the shared TOML says "at 100"; the old CV said "above 80".
  Proposed: keep the TOML text, since it is the shared source, and flag it for the user to confirm as a matter of fact.
- **Old PDF URLs:** `/resume.pdf` and `/David_Souther_CV.pdf` will return 404 once the committed PDFs are removed. GitHub Pages has no redirects.
  Proposed: accept the break. The alternative is to also emit copies at the old paths.
- **`cv.note` wording:** it still names SUNY Downstate. The print test requires only the words "Draft CV".
  Proposed: keep it until the user retargets the note.
- **Replacing the hand-written CV:** the Markdown source stays in git history only (quick-loop disposition 2, open for the user).
