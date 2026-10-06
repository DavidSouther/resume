# Intent review: design.md and tests/bptree_spill.rs (2026-10-03, quick-loop, cold dispatch)

Anchor: verbatim prompt in research.md Topic and Intent. This review clears no gate.

Resolved by the design since research-intent.md: Q1 (redb is prose only, no code, in Alternatives), Q3 (clap flag added, parse-only), and Q2 (point insert and lookup are core, ordered iter is optional).

Dropped as already settled: readers and writers as page reader and writer, module path, spill file format and location, flag default (all in Open Artifact Decisions), and joiners excluded (Out of scope in Purpose).

## Q1 (Design assumption)
As designed, `--max-hash-memory` is parsed into `Args` and consumed by nothing, because no caller of `BPlusTree::create` exists. The request asked for a B+ tree helper "to allow a --max-hash-memory flag for Hash that allows spilling". Is a parse-only flag, with the byte-budget wiring left to the future HASH joiner, what you intended?
Quick-loop default: yes. Parse the flag and add `max_hash_memory_bytes()`, with no joiner wiring.

## Q2 (Design assumption)
As designed, the budget bounds resident page bytes only. Pool bookkeeping (page table, LRU order) and temporary page buffers sit outside it, and the feature test asserts only `peak_resident_bytes() <= budget`. The request asked for a **max-hash-memory** limit. Is a page-bytes budget, documented as such, enough, or must total tree memory fit under the flag?
Quick-loop default: page bytes only, with the doc comment stating that bookkeeping is extra.
