# Intent review: build diff (2026-10-03, quick-loop, cold dispatch)

Anchor: verbatim prompt in research.md Topic and Intent. This review clears no gate.

Artifact: new `src/bptree/{mod,page,pool}.rs`, `tests/bptree_spill.rs`, and `src/main.rs` edits (flag, helper, doc bullet, two parse tests, `mod bptree` with `#[allow(dead_code)]`).

Aligned, no question: no joiner code was added, HASH and MERGE are untouched, the page reader and writer live in `page.rs`, and the flag is parse-only as design Q1 defaulted. Dropped as settled in design-intent.md or Open Artifact Decisions: page-bytes-only budget scope, module path, spill file format and location, flag default, redb as prose only.

## Q1 (Implementation surprise)
As implemented, `BPlusTree::create` fails with `InvalidInput` when the budget is under four pages (16 KiB), but `--max-hash-memory` accepts any `usize` kb, including 0 to 15. The request asked for a flag that "allows spilling the index to disk". Is it acceptable that a small flag value parses cleanly and only errors once a future joiner calls `create`, or should the flag reject values under 16 kb at parse time?
Quick-loop default: leave as is. Surface the error from `create` when the joiner is written.

## Q2 (Implementation surprise)
As implemented, residency is counted as whole `PAGE_SIZE` pages (`peak_resident_bytes() <= budget`), but each resident page is a decoded `Node` holding a `Vec<String>`, so real heap use per page exceeds 4096 bytes (per-key `String` headers and allocations). The request asked for a **max-hash-memory** limit. The doc comments say bookkeeping is extra, but do they, and the `--max-hash-memory` help text, make clear that decoded-node overhead also sits outside the figure?
Quick-loop default: yes. Keep the page-count accounting. Add a line to the flag doc only if you want the overhead named.

## Q3 (Implementation surprise)
As implemented, the tree supports insert and `get` only. There is no ordered `iter()`, although leaves are linked and main.rs's HASH pass 2 walks keys in sort order. The request asked to "only build the B+ tree utility" for HASH. Is a tree without ordered iteration enough for the future HASH joiner?
Quick-loop default: yes, per design (iter optional). Add `iter()` when pass 2 needs it.

## Q4 (Plan scope)
The crate suggestion ("AS AN ALTERNATIVE, suggest an appropriate crate") lives only in research.md and design.md Alternatives, not in the code diff or a doc comment in `src/bptree/mod.rs`. Is a recommendation in the session artifacts (redb, `MultimapTable<&str, u64>` with `set_cache_size`) the delivery you intended, or did you expect it in the repository?
Quick-loop default: session artifacts only.
