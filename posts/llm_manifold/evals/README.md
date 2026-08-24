# Manifold paper — eval (automated half of the Closing Bell)

This is the executable half of the project's Closing Bell (see
`../../.ailly/developer/2026-06-25-C-manifold/design.md`). The qualitative half is a
human read-cold study; this half gates the mechanical contract.

## What it checks

- **`scripts/check_sections.py`** — every required section heading from the outline
  contract is present and non-empty in `paper.md`.
- **`scripts/check_citations.py`** — every pandoc citation key (`[@key]`) used in
  `paper.md` resolves to an entry in `refs.bib`, and the claim-ledger table cites
  only known keys.
- **`scripts/check_pandoc.py`** — the pandoc build resolves citations and exits 0
  (`pandoc paper.md --citeproc --csl ieee.csl --bibliography refs.bib -t latex`).
  Targets `-t latex` so it validates citation resolution without a full TeX install.
- **Claim-ledger judge** — an LLM-as-judge over the ledger (every load-bearing claim
  tagged established/contested/author's-analogy; required caveats present; novelty
  not overclaimed). Lives in `manifold.yaml` as a `judge` assertion.

These run **red** today: the paper is a skeleton (incomplete ledger, TODO refs).

## Running

Standalone (no Ailly needed — works in this repo today):

```sh
python evals/scripts/check_sections.py llm_manifold/paper.md
python evals/scripts/check_citations.py llm_manifold/paper.md llm_manifold/refs.bib
python evals/scripts/check_pandoc.py llm_manifold/paper.md
```

Via Ailly (`manifold.yaml`) — **blocked on two things**, both tracked as tasks:

1. Ailly's eval loop is conversation-centric; a static `.md` needs a bridge until
   the **standalone/ad-hoc eval** feature lands (tracked in the `ailly_two` repo,
   deliberately left there).
2. The `resume` repo does not ship the `ailly` CLI. Wiring is a build-phase concern.

Until then, the standalone Python checkers above are the live gate; `manifold.yaml`
records the intended Ailly shape.
