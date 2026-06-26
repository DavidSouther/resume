#!/usr/bin/env python3
"""Check that the pandoc build resolves citations and exits 0.

Usage: check_pandoc.py [paper.md]
Targets `-t latex` so citation resolution is validated without a full TeX install.
Exit 0 = pandoc succeeded with no unresolved-citation warnings; exit 1 otherwise.
Exit 1 (with a clear message) if pandoc is not installed.
"""
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]


def main() -> int:
    paper = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "paper.md"
    bib = HERE / "refs.bib"
    csl = HERE / "ieee.csl"

    if shutil.which("pandoc") is None:
        print("pandoc not installed; cannot validate the build")
        return 1

    cmd = ["pandoc", str(paper), "--citeproc", "--bibliography", str(bib), "-t", "latex"]
    if csl.exists():
        cmd += ["--csl", str(csl)]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"pandoc failed (exit {proc.returncode}):\n{proc.stderr.strip()}")
        return 1
    if "[WARNING]" in proc.stderr and "citeproc" in proc.stderr.lower():
        print(f"pandoc reported citation warnings:\n{proc.stderr.strip()}")
        return 1
    print("OK: pandoc build resolved citations and exited 0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
