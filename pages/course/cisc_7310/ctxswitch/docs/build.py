#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["jinja2"]
# ///
"""Render docs/compare.html: each C original from docs/c/ next to its Rust port from src/."""
import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

docs = Path(__file__).parent
src = docs.parent / "src"

# (name, C file, Rust file, region name). With a region name, only the parts of the Rust file
# between `// docs:begin <region> <order>` and `// docs:end <region> <order>` are shown, by order.
PROGRAMS = [
    ("uctxswitch", "uctxswitch.c", "bin/uctxswitch.rs", None),
    ("uctxmake", "uctxmake.c", "bin/uctxmake.rs", None),
    ("uctxswap", "uctxswap.c", "bin/uctxswap.rs", None),
    ("uctxrestore", "uctxrestore.c", "bin/uctxrestore.rs", None),
    ("printctx", "printctx.c", "uctx.rs", "printctx"),
    ("umthreaddemo", "umthreaddemo.c", "bin/umthreaddemo.rs", None),
]

MARK = re.compile(r"^\s*// docs:(begin|end) (\S+) (\d+)\s*$")

def strip_comments(lines):
    """Drop every `//` comment (whole line or trailing) remove whole-line comments, and collapse repeated blank lines."""
    out = []
    for line in lines:
        quote, was_comment = False, False
        for i, ch in enumerate(line):
            if ch == '"' and (i == 0 or line[i - 1] != "\\"):
                quote = not quote
            elif not quote and line.startswith("//", i):
                line, was_comment = line[:i].rstrip(), True
                break
        if was_comment and not line.strip():
            continue
        if line.strip() or (out and out[-1].strip()):
            out.append(line)
    return out

def rust(path, region):
    """Return (text with comments removed, 1-based inclusive line ranges it came from)."""
    lines = (src / path).read_text().splitlines()
    if region is None:
        return "\n".join(strip_comments(lines)), None
    found = {}
    for n, line in enumerate(lines, 1):
        m = MARK.match(line)
        if m and m[2] == region:
            found.setdefault(int(m[3]), {})[m[1]] = n
    ranges = [(found[k]["begin"] + 1, found[k]["end"] - 1) for k in sorted(found)]
    return "\n\n".join("\n".join(strip_comments(lines[a - 1:b])) for a, b in ranges), ranges

def program(n, c, r, region):
    text, ranges = rust(r, region)
    return {"name": n, "c_path": f"c/{c}", "c": (docs / "c" / c).read_text(), "rs_path": f"src/{r}", "rs": text, "ranges": ranges}

programs = [program(*p) for p in PROGRAMS]
env = Environment(loader=FileSystemLoader(docs), autoescape=True)
(docs / "compare.html").write_text(env.get_template("compare.html.j2").render(programs=programs))
