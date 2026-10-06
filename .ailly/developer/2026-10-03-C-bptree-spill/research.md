# Research: B+ Tree Spill Helper for HASH

## Topic and Intent

> Write a B+ Tree Helper to allow a --max-hash-memory flag for Hash that allows spilling the index to disk, as well as the readers and writers. DO NOT implement any joiners at this time. Only build the B+ tree utility. AS AN ALTERNATIVE, suggest an appropriate crate.

The goal is a reusable, disk-backed ordered index for the HASH joiner in `csv_join`. The index must stay under a new `--max-hash-memory` budget by spilling nodes to a file. Joiner code stays out of scope.

## Search/Expand

**Existing code (`pages/course/cisc_7510/hw3`).** `main.rs` documents HASH as a five-pass plan. Pass 1 builds a key index of matching line pairs. Pass 2 builds sorters for what to emit from A and B. `--max-memory` explicitly excludes "the join key index and tracking details in HASH", which is the gap `--max-hash-memory` fills. `readers.rs` supplies `Record` (zero-copy `key()`/`rest()`/`line()`/`size()` over a shared `Arc<String>`), `Records`, `AsyncReader` (double-buffered batches bounded by `max_memory / 2`) and `SmallReader`. `writer.rs` supplies `JoinWriter` over `BufWriter`. `hash.rs` and `merge.rs` are empty, and `join.rs` holds the `Join` trait. No reader exposes a row's byte offset, so the index must use either row ordinals or offsets added later. The only dependency is `clap`.

**What a HASH index needs.** It needs a map from key (`&str` bytes) to a list of row positions per side (A and B). Operations are insert, point lookup, and ordered range scans so pass 2 can walk keys in sort order. Memory must be measurable in bytes so that resident nodes stay under `--max-hash-memory`, and cold nodes must be evicted to a page file. Durability, transactions, and crash safety are unnecessary because the file is scratch space.

**General practice.** Textbook disk B+ trees use fixed-size pages (commonly 4 KiB), with internal nodes holding separator keys and child page ids and leaves holding keys, values, and a next-leaf link. A buffer pool, usually LRU with dirty write-back, holds resident pages. Duplicate keys go either into a leaf value list or into a composite key `(key, side, position)`. The composite form keeps leaves fixed-shape and turns "all positions for key k" into a range scan. Grace hash join and external sort are equivalent spill strategies for the same problem.

**"As well as the readers and writers."** The most likely meaning is the B+ tree's own page reader and writer: node serialization to and from fixed pages, a page file, and the buffer pool that loads and flushes pages. A second reading asks for new CSV readers and writers for HASH, such as an offset-aware reader for pass 3 random access or writers for the intermediate files A' and B'. The existing CSV readers and writers already cover sequential I/O. This research assumes the first reading. The user should confirm.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. No crate under consideration ships a `SKILL.md`, MCP server, or `skills/` directory, so that omission is a finding.

| Crate | Fit | Status (verified 2026-10-03) |
|---|---|---|
| **redb** | Pure Rust, copy-on-write B-trees. `MultimapTable` stores many values per key with ordered `range()`. Page cache is capped by `Builder::set_cache_size`. MIT/Apache-2.0. | Active. v4.3.0 released 2026-09-14 [1], [2]. |
| persy | Pure Rust, single-file transactional engine with indexes. Supports multi-value index keys through `ValueMode::Cluster`. Heavier API. | Active. v1.8 released 2026-06 [3]. |
| sled | Pure Rust, lock-free. | Effectively unmaintained. 0.34.7 stable, and 1.0 alphas changed the on-disk format. Avoid [4]. |
| nebari | Append-only B-tree. | Self-described as early and unstable [5]. |
| jammdb | bolt-style B+ tree, mmap. | Last release about 3 years ago [6]. |
| heed / lmdb | Mature, multi-value via `DUP_SORT`. | Wraps C liblmdb, which is not pure Rust. mmap size, not a byte budget, governs memory. |
| b-tree, bplustree | Small B+ tree crates. | `b-tree` pulls in an async `freqfs` stack, and `bplustree` is in-memory only and stale [7]. |
| extsort / ext-sort | External merge sort with a bounded buffer and user serialization [8]. | Maintained. Not an index, but it replaces passes 1 and 2 with sort-then-merge. |

**Recommendation: `redb`.** `MultimapTable<&str, u64>` (or `<&[u8], (u8, u64)>` to tag the side) maps directly onto the HASH index. `set_cache_size(max_hash_memory)` bounds resident memory, and a temp-file database gives spill for free. It is pure Rust, actively released, and permissively licensed. The cost is transaction ceremony and an fsync per commit. A single write transaction per pass, with `Durability::None`, mitigates that cost. `extsort` is a worthwhile runner-up if HASH is redesigned as a sort-based pass.

## Falsification/Refine

The task is a single feature, a self-contained module (`src/bptree.rs`, or a submodule tree). It adds no joiner and no CLI wiring beyond the flag, and the flag can wait for design. Since `redb` already solves the problem, the hand-written tree is justified only by the course context, where implementing the structure is the point. The smallest honest version has these parts:

- Fixed-size page format with a serializer and deserializer.
- A page file, which is a temp file addressed by page id.
- A bounded LRU buffer pool that measures bytes and writes back dirty pages.
- Insert and search for duplicate-tolerant keys (composite `(key, side, pos)`).
- An ordered iterator across linked leaves.

Delete, concurrency, crash recovery, and free-page reuse are unnecessary for one-shot scratch use.

## Scope

**In:** the B+ tree module, its page reader and writer, its buffer pool bounded by a byte budget, and unit tests with tiny budgets that force spills. A redb-backed alternative is optional and should sit behind the same small trait if the user wants both.

**Out:** the HASH, MERGE, and LOOP joiners, changes to `AsyncReader`/`SmallReader`/`JoinWriter`, and passes 2 through 5.

## Resolved Decisions

- **Resolved:** `--max-hash-memory` bounds index memory separately from `--max-memory`, which matches the existing doc comment's exclusion.
- **Resolved:** No durability or transactions are needed, because the spill file is temporary.
- **Open:** Does "readers and writers" mean the B+ tree page I/O (assumed) or new CSV readers and writers?
- **Open:** Should index values be row ordinals or byte offsets? Offsets enable pass 3 seeks but need a reader change, which is out of scope here.
- **Open:** Should the project hand-roll the tree (course value) or adopt `redb` (recommended crate)? Or should it do both behind one trait?
- **Open:** Units for `--max-hash-memory` (kb, to match `--max-memory`) and its default.

## Sources

[1] C. Berner, "Release 4.3.0 · cberner/redb," GitHub, Sep. 2026. [Online]. Available: https://github.com/cberner/redb/releases/tag/v4.3.0

[2] "MultimapTable in redb," docs.rs. [Online]. Available: https://docs.rs/redb/latest/redb/struct.MultimapTable.html

[3] "Persy," lib.rs. [Online]. Available: https://lib.rs/crates/persy

[4] T. Neely, "spacejam/sled," GitHub. [Online]. Available: https://github.com/spacejam/sled

[5] "nebari," docs.rs. [Online]. Available: https://docs.rs/nebari

[6] "jammdb," crates.io. [Online]. Available: https://crates.io/crates/jammdb

[7] "b-tree keyword," crates.io. [Online]. Available: https://crates.io/keywords/b-tree

[8] "extsort," docs.rs. [Online]. Available: https://docs.rs/extsort
