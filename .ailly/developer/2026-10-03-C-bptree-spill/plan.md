# Implementation Plan: B+ Tree Spill Helper for HASH

**Feature test:** `pages/course/cisc_7510/hw3/tests/bptree_spill.rs`
**User story:** A future HASH joiner author inserts many duplicate-keyed `(key, u64)` pairs into a disk-backed B+ tree whose resident page bytes stay under a budget, and reads every value back.
**Libraries & Skills:** none. Std only inside `src/bptree/`, no `crate::` references.
**Steps:**
- [x] Step 0: API surface area
- [x] Step 1: Page format (reader and writer)
- [x] Step 2: Buffer pool with LRU eviction and spill
- [x] Step 3: Tree insert and get over the pool
- [x] Step 4: `--max-hash-memory` flag
- [x] Step 5: Feature test green and docs

All paths are under `pages/course/cisc_7510/hw3/`.

## Step 0: API surface area

Patterns: newtype for `PageId`, domain-objects for `Node` as an enum of `Leaf` and `Internal`. Stubs use `todo!()` bodies so the crate compiles.

```rust
// src/bptree/page.rs
pub const PAGE_SIZE: usize = 4096;
pub struct PageId(pub u64);
pub enum Node {
    Leaf { entries: Vec<(String, u64)>, next: Option<PageId> },
    Internal { keys: Vec<String>, children: Vec<PageId> },
}
pub fn encode(node: &Node, buf: &mut [u8; PAGE_SIZE]) -> io::Result<()>;
pub fn decode(buf: &[u8; PAGE_SIZE]) -> io::Result<Node>;
pub fn encoded_len(node: &Node) -> usize;

// src/bptree/pool.rs
pub const MIN_PAGES: usize = /* fixed in step 2 */;
/// Budget bounds resident page bytes only. Page table, LRU order, and
/// temporary buffers are extra.
pub struct Pool { /* file, frames, lru, counters */ }
impl Pool {
    pub fn create(path: &Path, max_memory: usize) -> io::Result<Pool>;
    pub fn allocate(&mut self, node: Node) -> io::Result<PageId>;
    pub fn read(&mut self, id: PageId) -> io::Result<&Node>;
    pub fn write(&mut self, id: PageId) -> io::Result<&mut Node>; // marks dirty
    pub fn peak_resident_bytes(&self) -> usize;
    pub fn pages_written(&self) -> usize;
}

// src/bptree/mod.rs
pub struct BPlusTree { /* pool, root */ }
impl BPlusTree {
    pub fn create(path: &Path, max_memory_bytes: usize) -> io::Result<BPlusTree>;
    pub fn insert(&mut self, key: &str, value: u64) -> io::Result<()>;
    pub fn get(&mut self, key: &str) -> io::Result<Vec<u64>>;
    pub fn peak_resident_bytes(&self) -> usize;
    pub fn pages_written(&self) -> usize;
}
impl Drop for BPlusTree { /* remove spill file, ignore errors */ }

// src/main.rs
// Args { max_hash_memory: usize } and Args::max_hash_memory_bytes(&self) -> usize
```

The feature test compiles after this step and fails at runtime on `todo!()`.

## Step 1: Page format (reader and writer)

**Enables:** the "readers and writers" requirement; nothing in the feature test can pass without a lossless page round trip.

Serialize a `Node` into a fixed 4096 byte buffer and parse it back. Layout sketch: a tag byte, entry count, next-leaf id (leaf only), then length-prefixed keys with values or child ids. Zero the unused tail.

**Tests** (`#[cfg(test)]` in `src/bptree/page.rs`)

```rust
#[test]
fn leaf_round_trips() {
    let node = Node::Leaf { entries: vec![("a".into(), 1), ("a".into(), 2), ("b".into(), 3)], next: Some(PageId(7)) };
    let mut buf = [0u8; PAGE_SIZE];
    encode(&node, &mut buf).unwrap();
    assert_eq!(decode(&buf).unwrap(), node);
}
```

- Internal node round trips.
- Empty leaf with `next: None`.
- Node whose `encoded_len` exceeds `PAGE_SIZE` returns `InvalidInput` from `encode`.
- Garbage tag byte returns `InvalidData` from `decode`.

**Implementation Outline**

```
encode: write tag, count, then for each entry write u16 key len, key bytes, u64 value (or child id)
decode: read tag, count, loop reading the same fields
encoded_len: header + sum of per-entry sizes
```

## Step 2: Buffer pool with LRU eviction and spill

**Enables:** `pages_written() > 0` and `peak_resident_bytes() <= BUDGET`.

A pool holding at most `max_memory / PAGE_SIZE` frames. Evicting the least recently used frame writes it to `page_id * PAGE_SIZE` in the spill file when dirty. Reading a non-resident id loads and decodes it. Track current and peak resident bytes (frames times `PAGE_SIZE`) and pages written. Fix `MIN_PAGES` here (proposed 4: root, path, split sibling). Budgets below it fail with `InvalidInput`. The doc comment states that the budget bounds page bytes only.

**Tests** (`#[cfg(test)]` in `src/bptree/pool.rs`)

```rust
#[test]
fn evicts_lru_and_reloads_from_disk() {
    let mut pool = Pool::create(&tmp_path(), MIN_PAGES * PAGE_SIZE).unwrap();
    let ids: Vec<_> = (0..MIN_PAGES + 3).map(|i| pool.allocate(leaf_with(i)).unwrap()).collect();
    assert!(pool.pages_written() > 0);
    assert!(pool.peak_resident_bytes() <= MIN_PAGES * PAGE_SIZE);
    assert_eq!(pool.read(ids[0]).unwrap(), &leaf_with(0));
}
```

- Budget below `MIN_PAGES * PAGE_SIZE` is `InvalidInput`.
- Clean (unmodified) page eviction does not increase `pages_written`.
- Modified page via `write` survives eviction and reload.
- Recently read page is not the next eviction victim.

**Implementation Outline**

```
frames: HashMap<PageId, Frame{node, dirty}>, lru: VecDeque<PageId>, next_id, file
touch(id): move id to back of lru
make_room(): while frames.len() >= cap, pop front of lru, if dirty encode and write_at, remove
read(id): if absent, make_room, read_at, decode, insert; touch; return &node
```

## Step 3: Tree insert and get over the pool

**Enables:** every assertion about returned values and the absent key; with the pool from step 2 the bound and spill assertions hold too.

Entries are ordered by `(key, insertion sequence)`: a new entry for an existing key goes after all current entries for it. Insert descends from the root, inserts into a leaf, and splits on overflow (`encoded_len > PAGE_SIZE`), pushing a separator up and splitting internals the same way, with a new root when the root splits. Separator choice must keep duplicates reachable: `get` descends to the leftmost leaf that may hold the key, then walks `next` links until the key is exceeded. Only hold a root-to-leaf path of pages across a split (at most `MIN_PAGES`). A key too long for several entries per leaf returns `InvalidInput`. `Drop` removes the spill file.

**Tests** (`#[cfg(test)]` in `src/bptree/mod.rs`)

```rust
#[test]
fn duplicates_span_leaves_in_insertion_order() {
    let mut tree = BPlusTree::create(&tmp_path(), 64 * PAGE_SIZE).unwrap();
    for v in 0..2000 { tree.insert("same", v).unwrap(); }
    assert_eq!(tree.get("same").unwrap(), (0..2000).collect::<Vec<_>>());
}
```

- Absent key returns an empty vector, including on an empty tree.
- Ascending, descending, and scrambled insert orders all return correct values.
- Many keys at a tiny budget keep `peak_resident_bytes() <= budget`.
- Oversize key is `InvalidInput`.
- Dropping the tree removes the spill file.

**Implementation Outline**

```
insert: path = descend(key, rightmost-for-equal); leaf.push in order; if overflow, split upward
split_leaf: move upper half to new page, set next links, return first key of new page
get: leaf = descend(key, leftmost-for-equal); collect matching entries; follow next while last entry matched
```

## Step 4: `--max-hash-memory` flag

**Enables:** the CLI journey. The flag is parse-only. No joiner wiring.

Add `max_hash_memory: usize` to `Args` (kb, default 1024) and `max_hash_memory_bytes()` beside `max_memory_bytes()`. Add a sibling bullet to the crate doc comment: the in-memory page budget for HASH's key index, beyond which index pages spill to a temp file. Add `mod bptree;` in `src/main.rs` with `#[allow(dead_code)]` since nothing calls it yet.

**Tests** (extend the existing `#[cfg(test)]` block in `src/main.rs`)

```rust
#[test]
fn parses_max_hash_memory() {
    let args = Args::parse_from(["csv_join", "--max-hash-memory", "256", "--join-type", "HASH", "a.csv", "b.csv"]);
    assert_eq!(args.max_hash_memory_bytes(), 256 * 1024);
}
```

- Default is 1024 kb when omitted.
- Existing `--max-memory` parse tests are unchanged and pass.

**Implementation Outline**

```
#[arg(long, default_value_t = 1024)] max_hash_memory: usize
fn max_hash_memory_bytes(&self) -> usize { self.max_hash_memory * 1024 }
```

## Step 5: Feature test green and docs

**Enables:** `spills_under_a_tiny_budget_and_returns_every_value` passing in full.

Run the feature test and fix any gaps it exposes (typically separator handling for duplicates across leaves, or a path held across eviction). Confirm `cargo test` for the whole crate and `cargo run -- --help` showing the flag and default. Ensure doc comments on `BPlusTree` and `Pool` state the memory contract: the budget bounds resident page bytes, and pool bookkeeping is extra.

**Tests**

- `cargo test --test bptree_spill` passes.
- `cargo test` passes with all existing targets unchanged.

**Implementation Outline**

```
run feature test, diagnose, adjust tree or pool, rerun full suite
```
