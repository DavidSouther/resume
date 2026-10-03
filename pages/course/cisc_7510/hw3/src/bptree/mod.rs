//! A disk-backed B+ tree from string keys to `u64` values, for HASH's key
//! index.
//!
//! Pages live in a buffer pool that keeps resident page bytes under a budget
//! and spills the rest to a scratch file.

use std::io;
use std::path::{Path, PathBuf};

mod page;
mod pool;

use page::{Node, PAGE_SIZE, PageId, entry_len};
use pool::Pool;

/// Pages of the budget reserved for an iterator's current and hot leaves.
const CURSOR_PAGES: usize = 2;

/// Fewest pages a tree's budget may hold: the pool's minimum plus the
/// iterator's reserved pages.
pub const MIN_PAGES: usize = pool::MIN_PAGES + CURSOR_PAGES;

/// Longest key `insert` accepts, in bytes. It keeps at least four entries in
/// a page, so every split leaves both halves within a page.
pub const MAX_KEY_LEN: usize = 1000;

/// A transient B+ tree index allowing duplicate keys.
///
/// Entries are ordered by key, then by insertion, so the values for one key
/// sit in adjacent leaf slots and may span several leaves.
///
/// The memory budget bounds resident page bytes only: at most
/// `max_memory_bytes / PAGE_SIZE` decoded pages are held at once. Two of them
/// are reserved for an iterator's current and hot leaves, and the pool holds
/// the rest. The pool's page table and LRU order and the root to leaf path of
/// page ids are extra. Pages beyond the budget spill to a scratch file, which
/// is removed when the tree is dropped.
pub struct BPlusTree {
    pool: Pool,
    root: PageId,
    path: PathBuf,
}

impl BPlusTree {
    /// Create or truncate the spill file at `path` and start an empty tree.
    /// Fails with `InvalidInput` when the budget holds fewer than
    /// `MIN_PAGES` (four) pages.
    pub fn create(path: &Path, max_memory_bytes: usize) -> io::Result<BPlusTree> {
        if max_memory_bytes < MIN_PAGES * PAGE_SIZE {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!(
                    "page budget of {max_memory_bytes} bytes is under the {} byte minimum",
                    MIN_PAGES * PAGE_SIZE
                ),
            ));
        }
        let mut pool = Pool::create(path, max_memory_bytes - CURSOR_PAGES * PAGE_SIZE)?;
        let root = pool.allocate(Node::Leaf {
            entries: Vec::new(),
            next: None,
        })?;
        Ok(BPlusTree {
            pool,
            root,
            path: path.to_path_buf(),
        })
    }

    /// Add one entry, after every existing entry for `key`. Fails with
    /// `InvalidInput` when `key` is longer than `MAX_KEY_LEN` bytes.
    pub fn insert(&mut self, key: &str, value: u64) -> io::Result<()> {
        if key.len() > MAX_KEY_LEN {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!(
                    "key of {} bytes is over the {MAX_KEY_LEN} byte limit",
                    key.len()
                ),
            ));
        }

        // Descend to the last leaf that may hold `key`, remembering each
        // internal page and the child slot taken.
        let mut path = Vec::new();
        let mut id = self.root;
        while let Node::Internal { keys, children } = self.pool.read(id)? {
            let slot = keys.partition_point(|k| k.as_str() <= key);
            path.push((id, slot));
            id = children[slot];
        }

        let Some(mut split) = self.insert_into_leaf(id, key, value)? else {
            return Ok(());
        };
        while let Some((parent, slot)) = path.pop() {
            match self.insert_into_internal(parent, slot, split)? {
                Some(next) => split = next,
                None => return Ok(()),
            }
        }
        let (separator, right) = split;
        self.root = self.pool.allocate(Node::Internal {
            keys: vec![separator],
            children: vec![self.root, right],
        })?;
        Ok(())
    }

    /// Every value for `key`, in insertion order. Empty when the key is
    /// absent.
    pub fn get(&mut self, key: &str) -> Values<'_> {
        Values(Entries::new(self, Some(key), Some(key)))
    }

    /// Every entry, ordered by key and then by insertion.
    pub fn iter(&mut self) -> Entries<'_> {
        Entries::new(self, None, None)
    }

    /// Most bytes of pages resident at once over the tree's life, counting
    /// the iterator's reserved pages as always held.
    pub fn peak_resident_bytes(&self) -> usize {
        self.pool.peak_resident_bytes() + CURSOR_PAGES * PAGE_SIZE
    }

    /// Pages written to the spill file over the tree's life.
    pub fn pages_written(&self) -> usize {
        self.pool.pages_written()
    }

    /// Insert into leaf `id`. When the leaf overflows, move its upper half to
    /// a new leaf and return the separator and new page for the parent.
    fn insert_into_leaf(
        &mut self,
        id: PageId,
        key: &str,
        value: u64,
    ) -> io::Result<Option<(String, PageId)>> {
        let node = self.pool.write(id)?;
        let Node::Leaf { entries, .. } = node else {
            unreachable!("descent ends at a leaf");
        };
        let at = entries.partition_point(|(k, _)| k.as_str() <= key);
        entries.insert(at, (key.to_string(), value));
        if page::encoded_len(node) <= PAGE_SIZE {
            return Ok(None);
        }
        let Node::Leaf { entries, next } = node else {
            unreachable!()
        };
        let at = split_index(entries.iter().map(|(k, _)| entry_len(k))) + 1;
        let upper = entries.split_off(at);
        let separator = upper[0].0.clone();
        let old_next = next.take();

        let right = self.pool.allocate(Node::Leaf {
            entries: upper,
            next: old_next,
        })?;
        if let Node::Leaf { next, .. } = self.pool.write(id)? {
            *next = Some(right);
        }
        Ok(Some((separator, right)))
    }

    /// Insert a child split from `children[slot]` into internal page `id`.
    /// When the node overflows, move its upper half to a new page and return
    /// the key pushed up with that page.
    fn insert_into_internal(
        &mut self,
        id: PageId,
        slot: usize,
        (separator, right): (String, PageId),
    ) -> io::Result<Option<(String, PageId)>> {
        let node = self.pool.write(id)?;
        let Node::Internal { keys, children } = node else {
            unreachable!("path holds internal pages");
        };
        keys.insert(slot, separator);
        children.insert(slot + 1, right);
        if page::encoded_len(node) <= PAGE_SIZE {
            return Ok(None);
        }
        let Node::Internal { keys, children } = node else {
            unreachable!()
        };
        let mid = split_index(keys.iter().map(|k| entry_len(k)));
        let upper_keys = keys.split_off(mid + 1);
        let pushed = keys.pop().expect("mid is a valid key index");
        let upper_children = children.split_off(mid + 1);

        let right = self.pool.allocate(Node::Internal {
            keys: upper_keys,
            children: upper_children,
        })?;
        Ok(Some((pushed, right)))
    }
}

impl Drop for BPlusTree {
    /// Remove the spill file, ignoring errors.
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

/// A leaf copied out of the pool for an iterator to drain.
struct Leaf {
    entries: std::vec::IntoIter<(String, u64)>,
    /// The next leaf, or `None` when this leaf already passes the upper bound.
    next: Option<PageId>,
}

/// Entries in key order between two inclusive bounds.
///
/// The cursor owns two leaves: the current one it yields from, and the hot
/// one after it. On the call after stepping onto a leaf it loads the next
/// leaf as the hot page, so crossing a leaf boundary is a swap rather than a
/// page read. Both leaves come out of the tree's two reserved pages.
///
/// The cursor borrows the tree mutably because reading a page through the
/// pool may evict another. A failed read is yielded where that leaf's entries
/// would be, and the iterator then ends.
pub struct Entries<'t> {
    tree: &'t mut BPlusTree,
    low: Option<String>,
    high: Option<String>,
    started: bool,
    current: Option<Leaf>,
    hot: Option<io::Result<Leaf>>,
    /// Whether `current` was swapped in during this call, so the hot load
    /// waits for the next one.
    fresh: bool,
}

impl<'t> Entries<'t> {
    fn new(tree: &'t mut BPlusTree, low: Option<&str>, high: Option<&str>) -> Self {
        Self {
            tree,
            low: low.map(str::to_string),
            high: high.map(str::to_string),
            started: false,
            current: None,
            hot: None,
            fresh: false,
        }
    }

    /// The first leaf that may hold the lower bound.
    fn seek(&mut self) -> io::Result<PageId> {
        let mut id = self.tree.root;
        while let Node::Internal { keys, children } = self.tree.pool.read(id)? {
            id = match &self.low {
                Some(low) => children[keys.partition_point(|k| k < low)],
                None => children[0],
            };
        }
        Ok(id)
    }

    fn load(&mut self, id: PageId) -> io::Result<Leaf> {
        let Node::Leaf { entries, next } = self.tree.pool.read(id)? else {
            unreachable!("leaves link only to leaves");
        };
        let more = entries
            .last()
            .zip(self.high.as_ref())
            .is_none_or(|((k, _), high)| k <= high);
        Ok(Leaf {
            next: next.filter(|_| more),
            entries: entries.clone().into_iter(),
        })
    }

    fn prefetch(&mut self) {
        if self.hot.is_none()
            && let Some(id) = self.current.as_ref().and_then(|leaf| leaf.next)
        {
            self.hot = Some(self.load(id));
        }
    }

    /// Replace the drained current leaf with the hot one, loading it now
    /// only if it was never prefetched. `None` when no leaf follows.
    fn advance(&mut self) -> Option<io::Result<()>> {
        let next = self.current.take()?.next;
        let leaf = match (self.hot.take(), next) {
            (Some(hot), _) => hot,
            (None, Some(id)) => self.load(id),
            (None, None) => return None,
        };
        self.fresh = true;
        Some(leaf.map(|leaf| self.current = Some(leaf)))
    }
}

impl Iterator for Entries<'_> {
    type Item = io::Result<(String, u64)>;

    fn next(&mut self) -> Option<Self::Item> {
        if !std::mem::replace(&mut self.started, true) {
            self.fresh = true;
            match self.seek().and_then(|id| self.load(id)) {
                Ok(leaf) => self.current = Some(leaf),
                Err(e) => return Some(Err(e)),
            }
        }
        loop {
            let Some((key, value)) = self.current.as_mut()?.entries.next() else {
                if let Err(e) = self.advance()? {
                    return Some(Err(e));
                }
                continue;
            };
            if self.low.as_ref().is_some_and(|low| &key < low) {
                continue;
            }
            if self.high.as_ref().is_some_and(|high| &key > high) {
                self.current = None;
                self.hot = None;
                return None;
            }
            if !std::mem::take(&mut self.fresh) {
                self.prefetch();
            }
            return Some(Ok((key, value)));
        }
    }
}

/// The values for one key, in insertion order. See `BPlusTree::get`.
pub struct Values<'t>(Entries<'t>);

impl Iterator for Values<'_> {
    type Item = io::Result<u64>;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|entry| entry.map(|(_, value)| value))
    }
}

/// Index of the entry whose bytes cross half of the total. Entries before it
/// take less than half, and entries after it take at most half, so with keys
/// within `MAX_KEY_LEN` both sides of an overflowing page fit in a page.
fn split_index(sizes: impl Iterator<Item = usize>) -> usize {
    let sizes: Vec<usize> = sizes.collect();
    let half = sizes.iter().sum::<usize>() / 2;
    let mut seen = 0;
    for (i, size) in sizes.iter().enumerate() {
        seen += size;
        if seen >= half {
            return i.min(sizes.len() - 2);
        }
    }
    unreachable!("an overflowing page has entries")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn tmp_path() -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("csv_join_bptree_{}_{n}.pages", std::process::id()))
    }

    fn tree(pages: usize) -> BPlusTree {
        BPlusTree::create(&tmp_path(), pages * PAGE_SIZE).unwrap()
    }

    fn values(tree: &mut BPlusTree, key: &str) -> Vec<u64> {
        tree.get(key).collect::<io::Result<_>>().unwrap()
    }

    #[test]
    fn duplicates_span_leaves_in_insertion_order() {
        let mut tree = tree(64);
        for v in 0..2000 {
            tree.insert("same", v).unwrap();
        }
        assert_eq!(values(&mut tree, "same"), (0..2000).collect::<Vec<_>>());
    }

    #[test]
    fn absent_key_is_empty() {
        let mut tree = tree(MIN_PAGES);
        assert!(values(&mut tree, "missing").is_empty());
        for v in 0..1000 {
            tree.insert(&format!("k{v:04}"), v).unwrap();
        }
        assert!(values(&mut tree, "missing").is_empty());
        assert!(values(&mut tree, "k").is_empty());
        assert!(values(&mut tree, "k0500x").is_empty());
    }

    fn check_order(order: impl Iterator<Item = u64>) {
        let mut tree = tree(MIN_PAGES);
        for k in order {
            tree.insert(&format!("key{k:04}"), k).unwrap();
            tree.insert(&format!("key{k:04}"), k + 10_000).unwrap();
        }
        for k in 0..3000 {
            assert_eq!(
                values(&mut tree, &format!("key{k:04}")),
                vec![k, k + 10_000]
            );
        }
    }

    #[test]
    fn ascending_inserts_return_every_value() {
        check_order(0..3000);
    }

    #[test]
    fn descending_inserts_return_every_value() {
        check_order((0..3000).rev());
    }

    #[test]
    fn scrambled_inserts_return_every_value() {
        check_order((0..3000).map(|i| i * 1009 % 3000));
    }

    #[test]
    fn long_keys_split_internal_nodes() {
        let mut tree = tree(MIN_PAGES);
        let key = |k: u64| format!("{k:0>width$}", width = MAX_KEY_LEN);
        for k in 0..200 {
            tree.insert(&key(k), k).unwrap();
        }
        for k in 0..200 {
            assert_eq!(values(&mut tree, &key(k)), vec![k]);
        }
    }

    #[test]
    fn iter_yields_every_entry_by_key_then_insertion() {
        let mut tree = tree(MIN_PAGES);
        let order: Vec<u64> = (0..3000).map(|i| i * 1009 % 3000).collect();
        for &k in &order {
            tree.insert(&format!("key{k:04}"), k).unwrap();
            tree.insert(&format!("key{k:04}"), k + 10_000).unwrap();
        }
        let entries: Vec<_> = tree.iter().collect::<io::Result<_>>().unwrap();
        let expected: Vec<_> = (0..3000)
            .flat_map(|k| [k, k + 10_000].map(|v| (format!("key{k:04}"), v)))
            .collect();
        assert_eq!(entries, expected);
    }

    #[test]
    fn hot_leaf_loads_the_call_after_stepping_onto_a_leaf() {
        let mut tree = tree(MIN_PAGES);
        for v in 0..2000 {
            tree.insert("same", v).unwrap();
        }
        let mut entries = tree.iter();
        entries.next().unwrap().unwrap();
        assert!(entries.hot.is_none(), "first call only seeks");
        entries.next().unwrap().unwrap();
        assert!(entries.hot.is_some(), "second call prefetches");

        while entries.current.as_ref().unwrap().entries.len() > 0 {
            entries.next().unwrap().unwrap();
        }
        entries.next().unwrap().unwrap();
        assert!(entries.hot.is_none(), "the boundary call only swaps");
        entries.next().unwrap().unwrap();
        assert!(entries.hot.is_some());
    }

    #[test]
    fn get_does_not_prefetch_past_its_key() {
        let mut tree = tree(MIN_PAGES);
        for k in 0..1000 {
            tree.insert(&format!("k{k:04}"), k).unwrap();
        }
        let mut values = tree.get("k0000");
        assert_eq!(values.next().unwrap().unwrap(), 0);
        assert!(values.0.current.as_ref().unwrap().next.is_none());
        assert!(values.next().is_none());
        assert!(values.0.hot.is_none());
    }

    #[test]
    fn iter_on_an_empty_tree_is_empty() {
        assert!(tree(MIN_PAGES).iter().next().is_none());
    }

    #[test]
    fn many_keys_stay_under_a_tiny_budget() {
        let mut tree = tree(MIN_PAGES);
        for k in 0..5000 {
            tree.insert(&format!("{k}"), k).unwrap();
        }
        assert!(tree.pages_written() > 0);
        assert!(tree.peak_resident_bytes() <= MIN_PAGES * PAGE_SIZE);
    }

    #[test]
    fn oversize_key_is_invalid_input() {
        let mut tree = tree(MIN_PAGES);
        let err = tree.insert(&"x".repeat(MAX_KEY_LEN + 1), 1).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn budget_below_min_pages_is_invalid_input() {
        let err = BPlusTree::create(&tmp_path(), PAGE_SIZE).err().unwrap();
        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn drop_removes_the_spill_file() {
        let path = tmp_path();
        let mut tree = BPlusTree::create(&path, MIN_PAGES * PAGE_SIZE).unwrap();
        tree.insert("a", 1).unwrap();
        assert!(path.exists());
        drop(tree);
        assert!(!path.exists());
    }
}
