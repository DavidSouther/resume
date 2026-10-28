# Normal Forms, as Data

Page at `/course/cisc_7510/normal_forms/`. One messy staffing table is carried through 1NF, 2NF, 3NF, BCNF / 4NF, and a post-BCNF document column. The values move, merge, and fade; the schema is secondary. Scroll, use the buttons, or press the arrow keys.

## Editing

Two files hold everything an author changes. Neither needs TypeScript.

### `content.md`: the narration

A Markdown document read in file order.

```markdown
# Page title

Intro paragraph, Markdown.

## {#1nf-violates:Toward 1NF}

Atomic fields: no complex columns. Marked columns break the rule: {{columns}}.
```

- The `#` heading is the page title. Text before the first `##` is the intro.
- Each `##` heading is one step. `{#id:Title}` is jiffdown inline syntax: the `id` keys the step and the text is the card title.
- Step bodies are Markdown (emphasis, links, code fences).
- `{{columns}}` is the marked columns of the highlighted stage, comma separated. `{{rows}}` is the row count of each table in the settled stage. Any other `{{name}}` is an error.
- Order and IDs must match the keyframes: `raw`, then `<stage>-violates` and `<stage>-settled` for `1nf`, `2nf`, `3nf`, `coda`, `post`. A missing, extra, duplicated, or misordered ID fails the build with a message naming it.

### `staffing.csv`: the sample table

The first table, with a header row. An empty field is NULL, an all-digit field is a number, and a field containing a comma is quoted (the list columns are). Every later stage is derived from this table in `dataset.ts`, so edit data here and the later tables follow. The 1NF step reads the columns `emp_id`, `emp_name`, `dept_id`, `dept_name`, `office`, `projects`, `skills`, `languages`, and `projects` values must look like `P1 Apollo (12h)`.

Preview while editing: `node scripts/serve.ts --port 8080 --watch`, then open `http://127.0.0.1:8080/course/cisc_7510/normal_forms/`.

## How it fits together

| File | Runs in | Role |
|---|---|---|
| `page.ts` | Node (build) | SSG page: renders keyframe 0, one narration section per keyframe, and embeds the CSV as `<script type="text/csv" id="nf-data">`. |
| `content.ts`, `narrate.ts`, `staffing.ts` | Node | Read and validate `content.md` and `staffing.csv`; fill placeholders. |
| `dataset.ts` | Both | Parses the CSV text and derives every stage. Each cell carries the IDs of the cells it came from. |
| `plan.ts` | Both | Keyframe order, and which cells move, merge, or vanish between stages. |
| `viewer.ts`, `animate.ts`, `client.ts` | Browser | Render tables, animate moves, and sync scroll, buttons, and arrow keys. |

The browser bundle starts at `client.ts` and must not import a `node:` module. `bundle.test.ts` enforces that.

## Tests

`npm test` runs everything, and `npm run check` runs types and lint.

- `content.feature.test.ts`: builds the site, then checks that the page follows `content.md` (IDs, order, titles, rendered Markdown, placeholders) and `staffing.csv` (rows rendered, text embedded).
- `normal_forms.feature.test.ts`: builds the site and checks the first table, step count, form buttons, and client module link.
- Unit tests sit beside each module. The two feature tests each run `npm run build` into `docs/`, so run this directory with `npx vitest run pages/course/cisc_7510/normal_forms --no-file-parallelism`.

Feature tests do not verify animation, scroll sync, or layout. Check those with `playwright-cli` against the served page.
