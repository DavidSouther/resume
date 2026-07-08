# Manifold paper — eval (automated half of the Closing Bell)

This is the executable half of the project's Closing Bell (see
`../../.ailly/developer/2026-06-25-C-manifold/design.md`). The qualitative half is a
human read-cold study; this half gates the mechanical contract.

## What it checks

- **`scripts/check_sections.py`** — every required section heading from the outline
  contract is present and non-empty in `paper.md`.
- **`scripts/check_citations.py`** — every pandoc citation key (`@key`, whether in a
  single `[@key]` or a multi-citation `[@key1; @key2]` bracket) used in `paper.md`
  resolves to an entry in `refs.bib`, and every `refs.bib` entry carries a year and
  an arXiv/DOI/URL/venue anchor.
- **`scripts/check_pandoc.py`** — the pandoc build resolves citations and exits 0
  (`pandoc paper.md --citeproc --csl ieee.csl --bibliography refs.bib -t latex`).
  Targets `-t latex` so it validates citation resolution without a full TeX install.
  Requires `ieee.csl` (present, fetched from the citation-style-language repo) and
  a local `pandoc` install.
- **Claim-ledger judge** — an LLM-as-judge over the Section 8 ledger against the
  six-field schema (Claim, Status, Support, Does not support, Section, Risk if
  wrong): every load-bearing claim is tagged established/contested/author-analogy/
  deferred and cited; every row's `Does not support` and `Risk if wrong` cells are
  non-empty and specific (not "N/A"); the required caveats are present; novelty is
  not overclaimed against Bradley et al. Lives in `manifold.yaml` as a `judge`
  assertion, extended for ledger completeness during Step 7 of the plan.

All three script checks and the pandoc build currently pass with **zero
arguments** from the repo root — every script's default resolves to the actual
`posts/llm_manifold/{paper.md,refs.bib,ieee.csl}` paths (fixed during Step 5 of
the plan; the defaults previously pointed one directory too shallow, into
`evals/`, and only worked when every path was passed explicitly).

## Authoring: sections/ vs. paper.md

`paper.md` is a **generated build artifact**, not the file to edit. The
source of truth is `../sections/*.md` — one file per logical unit of the
paper, numbered in final reading order (`01_abstract.md` through
`08_references.md`). After editing anything under `sections/`, regenerate
`paper.md`:

```sh
python posts/llm_manifold/evals/scripts/compose_paper.py
```

This concatenates the section files in numeric order and writes
`posts/llm_manifold/paper.md`, which is what every checker, test, and pandoc
itself actually reads. `check_sections.py` et al. were deliberately left
pointed at `paper.md`, not at `sections/`, so this split required no changes
to the existing eval scripts or tests.

## Running

Standalone (no Ailly needed — works in this repo today), from the repo root:

```sh
python posts/llm_manifold/evals/scripts/check_sections.py
python posts/llm_manifold/evals/scripts/check_citations.py
python posts/llm_manifold/evals/scripts/check_pandoc.py
```

Or with explicit paths, runnable from any working directory:

```sh
python posts/llm_manifold/evals/scripts/check_sections.py posts/llm_manifold/paper.md
python posts/llm_manifold/evals/scripts/check_citations.py posts/llm_manifold/paper.md posts/llm_manifold/refs.bib
python posts/llm_manifold/evals/scripts/check_pandoc.py posts/llm_manifold/paper.md
```

The `test_*.py` files alongside each script are unit/regression tests for the
scripts themselves and for each plan step's paper content; run any of them the
same way (`python posts/llm_manifold/evals/scripts/test_worked_analyses.py`).

Via Ailly (`manifold.yaml`) — **blocked on two things**, both tracked as tasks:

1. Ailly's eval loop is conversation-centric; a static `.md` needs a bridge until
   the **standalone/ad-hoc eval** feature lands (tracked in the `ailly_two` repo,
   deliberately left there).
2. The `resume` repo does not ship the `ailly` CLI. Wiring is a build-phase concern.

Until then, the standalone Python checkers above are the live gate; `manifold.yaml`
records the intended Ailly shape.
