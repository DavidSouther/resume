//! The write side of the index: inserts into a B+ tree whose pages live in
//! a bounded buffer pool.

use std::io;
use std::path::Path;

use super::page::{self, Node, PAGE_SIZE, PageId, entry_len};
use super::pool::Pool;
use super::reader::IndexReader;
use super::{MAX_KEY_LEN, SpillPath};

/// Builds an index from string keys to `u64` values, allowing duplicate
/// keys. Entries are ordered by key, then by insertion, so the values for one
/// key sit in adjacent leaf slots and may span several leaves.
///
/// The memory budget bounds resident page bytes only: at most
/// `max_memory_bytes / PAGE_SIZE` decoded pages are held at once. The pool's
/// page table and LRU order and the root to leaf path of page ids are extra.
/// Pages beyond the budget spill to a scratch file. Call `finish` to read
/// the index; dropping the builder instead removes the file.
pub struct IndexBuilder {
    pool: Pool,
    root: PageId,
    spill: SpillPath,
}

impl IndexBuilder {
    /// Create or truncate the spill file at `path` and start an empty index.
    /// Fails with `InvalidInput` when the budget holds fewer than
    /// `MIN_PAGES` pages.
    pub fn create(path: &Path, max_memory_bytes: usize) -> io::Result<IndexBuilder> {
        let mut pool = Pool::create(path, max_memory_bytes)?;
        let spill = SpillPath(path.to_path_buf());
        let root = pool.allocate(Node::Leaf {
            entries: Vec::new(),
            next: None,
        })?;
        Ok(IndexBuilder { pool, root, spill })
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

    /// Write every changed page to the spill file and hand it to a reader.
    pub fn finish(self) -> io::Result<IndexReader> {
        let IndexBuilder {
            mut pool,
            root,
            spill,
        } = self;
        pool.flush()?;
        Ok(IndexReader::new(pool.into_file(), root, spill))
    }

    /// Most bytes of pages resident at once while building.
    pub fn peak_resident_bytes(&self) -> usize {
        self.pool.peak_resident_bytes()
    }

    /// Pages written to the spill file while building, before `finish`.
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
