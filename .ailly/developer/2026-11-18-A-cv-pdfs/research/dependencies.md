# dependencies — libraries and skills

*2026-11-18.*

| Library | Version | Where | Skill shipped? |
|---|---|---|---|
| `@davidsouther/jiffies` (dom, ssg, server, components/card) | 2026.25.0 (`node_modules/@davidsouther/jiffies/package.json`) | resume components, SSG `main.js`, `makeServer` used by branch `scripts/build-pdfs.ts` | **None.** No `SKILL.md`/`skills/` in the package; README covers only module list and dev setup. No local checkout on disk (`/home/user/davidsouther/` holds only `ailly`). |
| `@davidsouther/jiffies-css` | ^2026.36.1 | page styling, print tokens | **Yes:** `node_modules/@davidsouther/jiffies-css/skills/jiffies-css-semantic-html/SKILL.md`, `.../jiffies-css-theming/SKILL.md` |
| `playwright` | 1.65.1 (branch adds devDependency; absent on main) | PDF printing | **Yes:** `node_modules/playwright-core/lib/tools/skills/playwright-cli/SKILL.md` (also `playwright-trace`, `playwright-component-testing`); AGENTS.md points at the brew copy of the same playwright-cli skill |
| `smol-toml` | 1.6.1 | `src/lib/loader.ts:7` | None |
| `marked`/`@davidsouther/jiffdown` (`MD()` in `src/components/p.ts`) | ^18 / ^2026.24 | Markdown in role text | None |

Docs that matter: Playwright `page.pdf()` options and CI guide (see public.md [9], [11]); MAC schema v0.3 (public.md [7]).

Closest worked examples in-repo: `src/components/resume/*.test.ts` (jsdom component tests), `pages/cv/cv-print.feature.test.ts` (print CSS via CSSOM), branch `scripts/build-pdfs.ts` + `scripts/ci-workflow.feature.test.ts:187-188`.

**Sources**

[1] Local package manifests and file listings under `/home/user/resume/node_modules`, read Nov. 18, 2026.
