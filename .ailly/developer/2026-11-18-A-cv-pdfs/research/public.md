# public — prior art (general lens)

*2026-11-18. Jeopardy! variants run: "single source resume CV variants", "tags filter resume highlights", "resume variants one YAML", "HTML to PDF CI print CSS", "Playwright pdf GitHub Actions cache".*

## One source, many views

- **JSON Resume** has no variant mechanism. The request to tag highlights for targeted variants (make `highlights` "an array of objects, where each object can have an array of tags") was opened 2023 and closed Oct 2026 by consolidation into the skills-model thread, not implemented [1].
- **RenderCV** (YAML → Typst → PDF) puts content and `design` in one file; its docs describe no variant/filter mechanism [2], [3]. **TailorCV**, a RenderCV extension, adds tags on entries and highlights; untagged items appear in every variant; a profile flag picks the variant [4].
- **EngineerCV** defines named `variants` groups in one YAML; "Each variant can override or extend any part of your resume", one PDF per combination [5].
- **HackMyResume / FluentCV** merge several JSON/FRESH files from generic to specific (base + overlay) [4], [6].
- **MAC (Manfred)** offers `publicArtifacts[].tags` "to segment and categorize elements in their CV" and a free `notes` on roles, and allows extra keys on jobs and entity details but not on roles [7].

Patterns: (a) tag-and-filter, untagged = everywhere (TailorCV); (b) base + overlay/override (EngineerCV, HackMyResume); (c) separate files per view (the repo's status quo on main). (a) with a narrow (b) for genuinely different text is the common middle.

## PDFs from a built site in CI

- Headless Chromium (Puppeteer/Playwright) is the norm in the JSON Resume ecosystem: resume-cli and `resumed` export PDF through Puppeteer `page.pdf()` [8].
- Playwright `page.pdf()` renders with `print` media by default; options include `preferCSSPageSize` ("Give any CSS `@page` size declared in the page priority"), `printBackground` (default false), `tagged` (accessible PDF) and `outline` (embedded document outline), both added in v1.42 [9].
- WeasyPrint implements CSS Paged Media more fully and needs no browser but runs no JS and handles modern layouts less faithfully; headless Chrome matches the browser render; headless Chrome does not fetch `url()` resources in `@page` rules [10].
- Typst/pandoc would mean a second, non-HTML template — the opposite of reuse here.
- CI caching: Playwright states "Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries," and Linux OS deps are not cacheable [11]. Community guides cache `~/.cache/ms-playwright` keyed on Playwright version anyway [12].

**Sources**

[1] stkrzysiak, "Idea: Could highlights have tags/keywords?," jsonresume, GitHub issue #303 (via resume-schema #464), May 2023. https://www.github.com/jsonresume/resume-schema/issues/464
[2] "rendercv: Typst-based CV/resume generator," PyPI. https://pypi.org/project/rendercv/
[3] RenderCV documentation. https://docs.rendercv.com/
[4] J. Cool, "TailorCV," GitHub (summary via search; page fetch failed). https://github.com/jessescool/TailorCV
[5] "engineercv 0.0.20 README," jsDelivr. https://cdn.jsdelivr.net/npm/engineercv@0.0.20/README.md
[6] "FluentCV README," jsDelivr. https://cdn.jsdelivr.net/npm/fluentcv@1.9.0-beta/README.md
[7] Manfred, "MAC schema v0.3." https://raw.githubusercontent.com/getmanfred/mac/v0.3/schema/schema.json
[8] "resumed 7.0.0 README," jsDelivr. https://cdn.jsdelivr.net/npm/resumed@7.0.0/README.md ; JSON Resume CLI docs. https://docs.jsonresume.org/cli
[9] Microsoft, "Page — page.pdf()," Playwright docs. https://playwright.dev/docs/api/class-page#page-pdf
[10] "Chrome headless print to PDF," drafts.arko.net, May 25, 2025. https://drafts.arko.net/2025/05/25/chrome-headless-print-to-pdf ; "HTML to PDF in Python — 4 options compared." https://21pdf-marketing.pages.dev/blog/html-to-pdf-python
[11] Microsoft, "Continuous Integration," Playwright docs. https://playwright.dev/docs/ci
[12] J. Poehnelt, "Caching Playwright in GitHub Actions." https://justin.poehnelt.com/posts/caching-playwright-in-github-actions/
