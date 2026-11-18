# Research: resume and CV from one source, PDFs in CI


## Topic and Intent

> quickloop build resume.pdf and cv.pdf during CI. Introduce dedicated /cv route that uses the same data, rearranged for academic focus (we might already have this?)

> Correction, both file names should be david_souther_cv|resume.pdf so that when people save them, they are distinct in their Downloads folders.

> Close the PR. Rerun the prompt using Ailly's quickloop process so it's got actual design. The resume and cv should reuse as much content as possible. For example, The academic interests are truly unique to the CV, but the CodeFellows role applies to both.

The goal: CI prints `david_souther_resume.pdf` and `david_souther_cv.pdf` from the built site. `/cv` renders from `src/resume.toml`, the same file as the resume, arranged for an academic reader. Every role, study and artifact is written once and appears in both views. Only material that exists for the CV alone, such as the research interests, lives apart from the resume data.

## Search/Expand

- **No resume standard has variants built in.** JSON Resume's request for per-highlight tags was closed in 2026 as a duplicate and never implemented [1]. RenderCV does not filter content [2], [3]. Tools that do it add one of two mechanisms:
  - Tag and filter: TailorCV puts tags on entries and highlights, and an untagged item appears in every variant [4].
  - Base plus overlay: EngineerCV `variants` "override or extend any part" of the resume [5]. HackMyResume and FluentCV merge files from generic to specific [6].
  The usual middle ground is to tag shared entries and override only text that must differ.
- **MAC v0.3 (this repo's schema) supports extension in some places and blocks it in others** [7]:
  - Extra keys are allowed on the root, on `experience.jobs[]` and on `publicEntityDetails` (organization and details).
  - Extra keys are not allowed on `role`, `challenges[]`, `projects[]`, `publicArtifacts[]`, `studies[]` or `competence`.
  - The only tag field is `publicArtifacts[].tags`. MAC describes it as a way "to segment and categorize elements in their CV".
  - `role.notes` is free text, and `knowledge.hardSkills` is MAC's own place for skills.
- **Headless Chromium is the usual way to print a resume to PDF.** resume-cli and resumed both export through Puppeteer `page.pdf()` [8].
  - Playwright `page.pdf()` uses print media and honours `preferCSSPageSize`. It also offers `tagged` (an accessible PDF) and `outline` (a document outline), both since v1.42 [9].
  - WeasyPrint supports paged media more fully but runs no JavaScript [10]. Typst or pandoc would mean a second template to maintain alongside the HTML one.
  - Playwright advises against caching browser binaries in CI. Restoring the cache takes about as long as downloading, and the Linux system dependencies cannot be cached [11]. Some community guides cache `~/.cache/ms-playwright` anyway [12].

Details: `research/public.md`.

## Libraries & Skills

*"Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: `jiffies-css-semantic-html` (`node_modules/@davidsouther/jiffies-css/skills/jiffies-css-semantic-html/SKILL.md`), `jiffies-css-theming` (`node_modules/@davidsouther/jiffies-css/skills/jiffies-css-theming/SKILL.md`), and `playwright-cli` (`node_modules/playwright-core/lib/tools/skills/playwright-cli/SKILL.md`, the same guide AGENTS.md points at) for visual and print verification."*

- **@davidsouther/jiffies 2026.25.0.** Provides `dom/html.ts`, `components/card.ts`, the SSG and `server/http` `makeServer`.
  - **It ships no agentic skill.** There is no `SKILL.md` or `skills/` folder in the package, and no local checkout on disk. Treat this as a finding.
  - Closest examples: `src/components/resume/*.ts` and their `*.test.ts`.
- **@davidsouther/jiffies-css.** Provides the print tokens retuned by `.cv` in `src/global.css`. The two skills above are its own.
- **playwright 1.65.1.** Not a dependency on main; the closed branch added it. The docs that matter are `page.pdf()` [9] and the CI guide [11]. The skill is listed above.
- **smol-toml 1.6.1** (`src/lib/loader.ts:7`). No skill. The loader casts the parsed TOML to the expected type without checking it against the schema.
- **MAC schema v0.3** [7] is the data contract. Nothing in the repo validates against it, so the constraint only reaches editor tooling.

Details: `research/dependencies.md`.

## Falsification/Refine

**Size.** This is a single feature with three parts:
1. Data: one shared source, with a selection setting for each view.
2. Rendering: a `/cv` view built from that source.
3. Build: a PDF step in the shared action `.github/actions/build-site`.
No other team is involved. No off-the-shelf tool reads MAC TOML, renders variants and prints into this SSG, but Playwright covers the printing.

**What the codebase already provides** (citations in `research/codebase.md`):
- **The resume already hides entries per view, using CSS classes only.** `show()` (`src/lib/util.ts:1-8`) adds `no-print` to jobs that ended before 2018 (`src/components/resume/job-detail.ts:17-18`). Unfinished studies are hidden from print (`studies.ts:6-7`), and publications without a URL are filtered out (`resume.ts:23-25, 72`).
- **The type file already has per-entry view flags.** `full?` and `hide?` are declared in `src/lib/resume.d.ts` but unused in the TOML.
- **Teaching appears in 8 jobs, all already in `experience.jobs`:**
  - Pure teaching jobs: Code Fellows, Chatham and Mt Holyoke.
  - Jobs whose descriptions contain teaching that the old CV split into separate entries: Google Shopping ("Internal instruction") and Third Cat ("ProTech").
  - Jobs that feed the old CV's Curriculum and Mentorship sections: AWS AI Lab (Code Explainer), GCP Compute Front End (management) and Apollo (Rust mentoring).
- **Most of the old CV is already covered by existing data:**
  - Its five Software entries are the five `experience.projects`.
  - Its publications other than the essays are already `publicArtifacts`; the defensive publication is already tagged.
  - All 14 essays are existing `posts/*.md` with `title`/`date`/`summary` front matter.
  - The talks and service entries restate text from job descriptions.
- **Content written only for the old CV, with no counterpart in the data:**
  - The four Research Interests paragraphs.
  - The SUNY Downstate draft note, shown on screen only.
  - The footer.
  - The labelled groups of Technical Competencies.
  - The "in preparation" manuscript (draft post `posts/llm_manifold`, `show: false`).
  - NVD3 and JEFRi listed as software entries.
- **The closed attempt's main defect.** It rendered every job under Professional Appointments and also kept a separately worded `[[academic.teaching]]` list (branch `src/lib/cv.ts:104-117`). So the teaching roles printed twice, with contradicting facts.

**Smallest honest design space** (for design to choose from; not a design):
1. **Write each job once and keep one text for it.** A teaching job gets a schema-legal key on `experience.jobs[]` that places it in the CV's teaching section. Every other job goes under the CV's professional section, and each job appears in exactly one CV section.
2. **Mark artifacts with the existing `publicArtifacts[].tags`.** Tags would place artifacts in CV groups (Defensive Publication, Curriculum, and so on). Projects need a schema-legal place for the same marker, such as `details.*` or the job level, or a list kept in the CV-only table.
3. **Keep a small root table for CV-only content.** The root allows extra keys. The table holds the interests, the draft note, the footer, competency groups (or `knowledge.hardSkills`), and an ordered list of `posts/` ids for the essays, so the essay text is not copied.
4. **Use render-side transforms, not text overrides.** Examples: removing links from role titles (branch `plainTitle`, `cv.ts:47-50`) and formatting dates. Override text only where a fact or the voice genuinely differs, and right now none must.
5. **Print in CI with Playwright Chromium after `build:site`, inside the composite action.** The `site-<tree>` artifact then carries the PDFs, and `deploy.yml`'s reuse path ships them unchanged. Do not cache the browser [11].

**The smallest version that still meets the intent:**
- A `/cv` built from the shared jobs, studies, projects and artifacts, plus a CV-only table holding the interests (and the note and footer).
- No separate Curriculum, Mentorship, Talks or Service sections that restate job text. The essays come from post ids.
- Two PDFs printed in CI.
- The cost: the old CV's content is reworded or dropped wherever it disagreed with the shared text. The user must decide which wording wins.

**Falsification check.** Claim tested: "every old-CV section can come from shared data except the interests."
- Refuted for three items: the competency groups, the manuscript, and the NVD3 and JEFRi software entries. Each needs a new home in the data or must be cut.
- Partly refuted for Talks and Service, which exist only inside job description text.

## Scope

**In:**
- Data model changes to `src/resume.toml` and `src/lib/resume.d.ts` for per-view selection.
- Resolving each conflicting text to one wording.
- Rendering `/cv` from the shared data, and deciding whether to reuse the `src/components/resume/*` DOM components or keep generating Markdown for the existing `.cv` print CSS.
- `scripts/build-pdfs.ts` (with Playwright as a devDependency), the build-site action, the mise task, and tests in the style of `scripts/ci-workflow.feature.test.ts` and `pages/cv/cv-print.feature.test.ts`.
- Removing `content/cv-suny-downstate.md` and the PDFs committed to `public/`.

**Out:**
- Typst, pandoc or WeasyPrint pipelines.
- JSON Resume conversion.
- Caching Playwright browsers.
- Redesigning the resume's look.
- New CV content beyond what the old CV held.
- Validating against the MAC schema in CI, unless design asks for it.

## Resolved Decisions

- **Should the teaching roles stay in `experience.jobs`?** Yes. They already hold the shared text, and the CV selects them from there, as the user's Code Fellows example requires.
- **Where can selection keys go without breaking the schema?** On `experience.jobs[]`, on `publicEntityDetails`, as `publicArtifacts[].tags`, and on the root. Not on `role` [7].
- **What prints the PDFs?** Playwright Chromium `page.pdf` on the built `docs/`, with names `david_souther_resume.pdf` and `david_souther_cv.pdf`.
- **Can the essays come from existing data?** Yes, from `posts/` front matter, so the CV does not need a copy of the essay text.
- **Open for design: which wording wins for Code Fellows NPS?** The TOML says "at 100" (`src/resume.toml:245-247`); the old CV says "above 80". This is a factual question for the user.
- **Open for design: one voice across shared text?** The resume is written in first person and the old CV impersonally. Design should also check whether "Smith University" (`src/resume.toml:504`) should be "Smith College".
- **Open for design: which education descriptions are kept?** The TOML and old-CV versions differ, including the BS CS cluster/genome story.
- **Open for design: how does the CV group employers?** The TOML has separate AWS and Google teams; the old CV groups them under one employer with team subheads.
- **Open for design: should synthesized CV entries be kept, derived or dropped?** These are Google internal instruction, ProTech, the Mentorship section, Talks, Service, the competency groups, the manuscript, NVD3 and JEFRi.
- **Open for design: what happens to the old PDF URLs?** `/resume.pdf` and `/David_Souther_CV.pdf` will return 404. Options are to also emit copies there or accept the break; GitHub Pages has no redirects.
- **Open for design: should `/cv` reuse the resume's DOM components or generate Markdown?** Reusing the components shares more code; Markdown keeps the current `.cv` print CSS and its 11 tests as they are.
- **Open for design: what about print-time network dependencies?** PDF output depends on Google Fonts (`src/global.css:11`) and jiffies-css from unpkg. The options are to accept this or to self-host the fonts.
- **Open for design: should the PDFs be tagged and carry an outline?** These are the `tagged` and `outline` options [9], which help accessibility.
- **Note only:** the user's third follow-up reframes the original scope from "render /cv from data" to "maximize content reuse". This research is scoped to the third follow-up.

## Sources

[1] stkrzysiak, "Idea: Could highlights have tags/keywords?," jsonresume, GitHub issue (transferred from resume-schema #464), May 2023. https://www.github.com/jsonresume/resume-schema/issues/464
[2] "rendercv: Typst-based CV/resume generator," PyPI. https://pypi.org/project/rendercv/
[3] RenderCV documentation. https://docs.rendercv.com/
[4] J. Cool, "TailorCV," GitHub. https://github.com/jessescool/TailorCV
[5] "engineercv 0.0.20 README," jsDelivr. https://cdn.jsdelivr.net/npm/engineercv@0.0.20/README.md
[6] "FluentCV README," jsDelivr. https://cdn.jsdelivr.net/npm/fluentcv@1.9.0-beta/README.md
[7] Manfred, "MAC schema v0.3," GitHub. https://raw.githubusercontent.com/getmanfred/mac/v0.3/schema/schema.json
[8] "resumed 7.0.0 README," jsDelivr. https://cdn.jsdelivr.net/npm/resumed@7.0.0/README.md ; JSON Resume, "CLI." https://docs.jsonresume.org/cli
[9] Microsoft, "Page: page.pdf()," Playwright documentation. https://playwright.dev/docs/api/class-page#page-pdf
[10] "Chrome headless print to PDF," drafts.arko.net, May 25, 2025. https://drafts.arko.net/2025/05/25/chrome-headless-print-to-pdf
[11] Microsoft, "Continuous Integration," Playwright documentation. https://playwright.dev/docs/ci
[12] J. Poehnelt, "Caching Playwright in GitHub Actions." https://justin.poehnelt.com/posts/caching-playwright-in-github-actions/
