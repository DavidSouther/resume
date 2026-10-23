"""Orchestrates the full pipeline end to end, stopping at the one gate
that requires a human: classification review.

Usage:
    python run_pipeline.py            # pull, classify, aggregate, cross-check
    python run_pipeline.py --inspect  # only run schema inspection (step 0)
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent


def run(script: str, *args: str) -> None:
    print(f"\n=== {script} {' '.join(args)} ===")
    result = subprocess.run(
        [sys.executable, str(SRC_DIR / script), *args], cwd=SRC_DIR
    )
    if result.returncode != 0:
        raise SystemExit(
            f"{script} exited with {result.returncode} — fix the issue above "
            f"before continuing."
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Run only schema inspection (step 0), then stop for human review.",
    )
    args = parser.parse_args()

    run("inspect_schema.py")
    if args.inspect:
        print(
            "\nSchema inspection done. Review config/classification.generated.yaml, "
            "fill in config/classification.yaml, then re-run without --inspect."
        )
        return

    run("pull_permits.py")
    run("pull_capital_projects.py")
    run("pull_plazas.py")
    run("classify.py")  # refuses (exit 1) if classification.yaml is incomplete
    run("build_table.py")
    run("crosscheck.py")


if __name__ == "__main__":
    main()
