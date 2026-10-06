# Intent review: research.md (2026-10-03, quick-loop, cold dispatch)

Anchor: verbatim prompt in research.md Topic and Intent. This review clears no gate.

Dropped as already settled: readers/writers meaning, row ordinal vs offset, hand-roll vs redb, units/default (all in artifact Open list, or resolved by the request).

## Q1 (Research gap, highest priority)
As researched, Scope includes an optional redb-backed implementation behind a trait, and the recommendation reads as "adopt redb". The request asked to **"Write a B+ Tree Helper"** and, "AS AN ALTERNATIVE, suggest an appropriate crate." Is a crate only a written suggestion, with no redb code?
Quick-loop default: yes. Build only the hand-written tree. Name redb in prose, no code or trait.

## Q2 (Blind spot)
The request implies a spillable index for a **Hash** structure. Research oriented around ordered range scans for HASH pass 2, and that need comes from main.rs's plan, not from the request. What has that framing made invisible? Hash-style point lookup and insert may be all that is wanted, and ordered leaf links may be unneeded.
Quick-loop default: keep point insert and lookup as core. Include ordered iteration as a cheap extra.

## Q3 (Blind spot)
"Allows a --max-hash-memory flag" may mean the flag is wired into the CLI. Research says "the flag can wait for design" and the Out list omits it. Should the clap flag be added now, or only a byte-budget constructor parameter?
Quick-loop default: add the clap flag, parsed and passed nowhere beyond the B+ tree constructor, with no joiner wiring.
