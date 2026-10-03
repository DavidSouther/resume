# Design: B+ Tree Spill Helper for HASH


Load skills before working on this feature: none (per research.md, Libraries & Skills).

## Purpose

`csv_join`'s HASH joiner needs a key index (pass 1 in `main.rs`) whose size `--max-memory` explicitly does not cover. This design adds a disk-backed B+ tree that holds that index while keeping resident page memory under a new `--max-hash-memory` budget, spilling cold pages to a scratch file. It also adds the flag to the CLI. No joiner uses either yet; HASH and MERGE stay `todo!()`.

## Prior Art

- Textbook disk B+ trees: fixed 4 KiB pages, internal nodes of separator keys and child page ids, leaves of entries plus a next-leaf link, and an LRU buffer pool with dirty write-back.
- `redb` (v4.3.0, 2026-09) provides the same capability off the shelf (see Alternatives).
- In this crate, `readers.rs` and `writer.rs` set the style: small focused types, doc comments that state the memory contract, std only, and `#[cfg(test)]` unit tests beside the code.

## User Journey and Metrics

The user is the future HASH joiner author (David), working in code.

Given a byte budget and a scratch file path, when they insert many `(key, value)` pairs, including repeated keys, into the tree, then `get(key)` returns every value inserted under that key, the tree's resident page bytes never exceed the budget, and the scratch file is removed when the tree is dropped.

On the CLI, `csv_join --max-hash-memory 256 --join-type HASH a.csv b.csv` parses, and the help text documents the flag in kb with a 1024 kb default. Behavior is otherwise unchanged.

Metrics, all asserted by tests:

- Correctness: every inserted value comes back for its key, and an absent key returns no values.
- Bound: the peak of resident page bytes is at most the budget for the whole life of the tree.
- Spill happens: with a budget far below the data size, at least one page is written to the scratch file.

## Specification

**Module layout.** A new directory module `src/bptree/`, declared from `main.rs` as `mod bptree;`:

- `mod.rs`: `BPlusTree`, the public face. Insert, point lookup, node splits.
- `page.rs`: the page format. A page writer serializes a leaf or internal node into a fixed `PAGE_SIZE` (4096) byte buffer, and a page reader parses it back. This is the "readers and writers" of the request.
- `pool.rs`: the buffer pool. It holds resident pages up to `max_memory / PAGE_SIZE`, evicts the least recently used page, writes dirty pages back to the spill file at offset `page_id * PAGE_SIZE`, and reloads pages on demand. It tracks current and peak resident bytes and pages written.

The module uses only `std` and nothing from `crate::`, so it compiles in isolation (see Testability).

**Public API (call shapes).**

- `BPlusTree::create(path, max_memory_bytes) -> io::Result<BPlusTree>` creates or truncates the spill file. It fails with `InvalidInput` when the budget holds fewer than a minimum number of pages (enough for a root to leaf path plus a split; the plan fixes the number).
- `tree.insert(key: &str, value: u64) -> io::Result<()>`. Duplicate keys are allowed and each insert adds one entry. Values are opaque `u64`s, such as row ordinals, and a caller may tag the side in a high bit. A key too long to fit several entries in a leaf fails with `InvalidInput`.
- `tree.get(key: &str) -> io::Result<Vec<u64>>` returns all values for the key in insertion order, or an empty vector. It takes `&mut self` because lookups load pages through the pool.
- `tree.peak_resident_bytes() -> usize` and `tree.pages_written() -> usize` expose the pool's counters for tests and diagnostics.
- Dropping the tree deletes the spill file and ignores errors, as `JoinWriter`'s drop does.

**Duplicates.** Entries are ordered by `(key, insertion sequence)`, so all values for a key sit in adjacent leaf slots, possibly spanning leaves. `get` descends to the first match and walks next-leaf links. That same link makes an ordered `iter()` cheap, and the build phase may add it. It is not required.

**CLI flag.** `Args` gains `max_hash_memory: usize`, in kb, default 1024, with an `Args::max_hash_memory_bytes()` helper mirroring `max_memory_bytes()`. The crate doc comment's `--max-memory` bullet gains a sibling bullet for `--max-hash-memory`: the in-memory page budget for HASH's key index, beyond which index pages spill to a temp file. The flag is parsed and not passed anywhere, since no joiner exists.

**Testability.** This is a binary crate without `lib.rs`. Rather than restructure the crate, the integration test includes the module source directly with `#[path = "../src/bptree/mod.rs"] mod bptree;`. That is why the module must not reference `crate::`. Unit tests for page round trips and pool eviction live in `#[cfg(test)]` blocks inside `page.rs` and `pool.rs`.

**Failure modes.** I/O errors from the spill file propagate as `io::Error` out of `insert` and `get`. A too-small budget and an oversize key are `InvalidInput`. The tree does not support delete, concurrency, crash recovery, or free-page reuse, because the file is one-shot scratch space.

**Verification.** Automated: the feature test below, page and pool unit tests, a clap parse test for the new flag, and the existing `cargo test` suite unchanged. Manual: `cargo run -- --help` shows the flag and default.

## Feature Test

Path: `pages/course/cisc_7510/hw3/tests/bptree_spill.rs` (test `spills_under_a_tiny_budget_and_returns_every_value`).

It creates a tree with a 16 KiB budget (four pages) in `CARGO_TARGET_TMPDIR`. It inserts 20,000 entries over 5,000 keys in a scrambled order, four values per key. It asserts that every key returns exactly its four values in insertion order, that an absent key returns nothing, that `pages_written() > 0`, that `peak_resident_bytes() <= budget`, and that the spill file is gone after drop. It is red now because `src/bptree/mod.rs` does not exist, so the test target fails to compile with a missing module file error. The binary and other test targets still build.

## Alternatives

- **`redb`** (recommended crate). `MultimapTable<&str, u64>` is exactly this index, and `Builder::set_cache_size` bounds memory. It is pure Rust, maintained, and MIT or Apache-2.0. It is not used because the request asks for the B+ tree to be written, and the course context values the hand-built structure. It is named here only as the off-the-shelf substitute, with no code or dependency.
- **Hash table plus Grace partitioning.** Spill hashed partitions to files and join partition by partition. It is simpler for point lookups, but it is not a reusable ordered index and does not match the requested "B+ Tree Helper".
- **External sort (`extsort`).** It would replace passes 1 and 2 with sort then merge. That is a redesign of HASH, which is out of scope.
- **Adding `src/lib.rs`** for testability. It is cleaner long term but restructures the crate for one module. The `#[path]` include keeps the change local, and moving to a library is a reasonable follow-up.

## Summary

Build a std-only, duplicate-tolerant B+ tree in `src/bptree/` with its own page reader and writer and a byte-bounded LRU buffer pool that spills to a scratch file. Add a parse-only `--max-hash-memory` flag (kb, default 1024). Deferred: ordered `iter()` (optional), the exact minimum page count, and wiring into a HASH joiner.

### Open Artifact Decisions

**Module path `src/bptree/` (mod.rs, page.rs, pool.rs):** a single `src/bptree.rs` file, or a directory module. Proposed: directory module, so the page reader and writer and the pool stay small, and so the `#[path]` include resolves submodules under `src/bptree/`.

**Spill file format:** raw concatenated `PAGE_SIZE` pages addressed by page id, with no header, versus a header page with magic and metadata. Proposed: raw pages without a header, because the file never outlives the process.

**Spill file location:** caller-supplied path only, or also a `std::env::temp_dir()` default. Proposed: `create` takes an explicit path, and the future joiner picks a name under `temp_dir()`.

**`--max-hash-memory` default:** Proposed: 1024 kb, matching `--max-memory`.

**Revision 2026-10-03 (review pause).** At the user's request the crate now has `src/lib.rs` exporting `bptree`, `join`, `loop`, `readers`, and `writer`. `main.rs` imports from `csv_join::`, and `tests/bptree_spill.rs` uses `csv_join::bptree::BPlusTree` instead of the `#[path]` include. This supersedes the Testability paragraph and the `lib.rs` alternative above.

**Revision 2026-10-03 (review pause).** `get` now returns `Values<'_>`, an `Iterator<Item = io::Result<u64>>`, in place of `io::Result<Vec<u64>>`. `iter()` returns `Entries<'_>`, which yields every `(key, value)` by key and then by insertion. Both share one cursor that buffers only the current leaf's matching entries, so a hot key no longer loads all its values at once. The cursor borrows the tree mutably, so no inserts can happen while it is live.

**Revision 2026-10-03 (review pause).** The `Entries` cursor owns a current leaf and a hot leaf. It loads the hot leaf on the call after stepping onto a leaf, so a boundary call is an O(1) swap, and the page read still runs on the calling thread one leaf ahead. A range cursor stops at its first key above the upper bound and never prefetches past it. The tree reserves `CURSOR_PAGES = 2` of the budget for those leaves. `pool::MIN_PAGES` drops to 2 (a page being split plus its sibling), so the tree's `MIN_PAGES` stays at 4. `peak_resident_bytes()` now counts the reserved pages as always held.
