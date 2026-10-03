//! The read side of the index: cursors over a finished B+ tree, reading
//! leaves straight from the spill file.

use std::fs::File;
use std::io;

use super::SpillPath;
use super::page::{self, Node, PageId};

/// A finished index. It never writes, so reads take `&self` and any number
/// of cursors may be open at once. Each cursor reads pages from the spill
/// file with positioned reads and holds at most two leaves; the reader keeps
/// no pages of its own. The spill file is removed when the reader drops.
pub struct IndexReader {
    file: File,
    root: PageId,
    _spill: SpillPath,
}

impl IndexReader {
    pub(super) fn new(file: File, root: PageId, spill: SpillPath) -> Self {
        Self {
            file,
            root,
            _spill: spill,
        }
    }

    /// Every value for `key`, in insertion order. Empty when the key is
    /// absent.
    pub fn get(&self, key: &str) -> Values<'_> {
        Values(Entries::new(self, Some(key), Some(key)))
    }

    /// Every entry, ordered by key and then by insertion.
    pub fn iter(&self) -> Entries<'_> {
        Entries::new(self, None, None)
    }
}

/// A leaf read from the spill file for an iterator to drain.
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
/// page read. A cursor holds at most those two pages, plus one internal page
/// while it seeks its first leaf.
///
/// A failed read is yielded where that leaf's entries would be, and the
/// iterator then ends.
pub struct Entries<'r> {
    index: &'r IndexReader,
    low: Option<String>,
    high: Option<String>,
    started: bool,
    current: Option<Leaf>,
    hot: Option<io::Result<Leaf>>,
    /// Whether `current` was swapped in during this call, so the hot load
    /// waits for the next one.
    fresh: bool,
}

impl<'r> Entries<'r> {
    fn new(index: &'r IndexReader, low: Option<&str>, high: Option<&str>) -> Self {
        Self {
            index,
            low: low.map(str::to_string),
            high: high.map(str::to_string),
            started: false,
            current: None,
            hot: None,
            fresh: false,
        }
    }

    /// The first leaf that may hold the lower bound.
    fn seek(&self) -> io::Result<Leaf> {
        let mut id = self.index.root;
        loop {
            match page::read_at(&self.index.file, id)? {
                Node::Internal { keys, children } => {
                    id = match &self.low {
                        Some(low) => children[keys.partition_point(|k| k < low)],
                        None => children[0],
                    };
                }
                leaf => return Ok(self.leaf(leaf)),
            }
        }
    }

    fn load(&self, id: PageId) -> io::Result<Leaf> {
        page::read_at(&self.index.file, id).map(|node| self.leaf(node))
    }

    fn leaf(&self, node: Node) -> Leaf {
        let Node::Leaf { entries, next } = node else {
            unreachable!("leaves link only to leaves");
        };
        let more = entries
            .last()
            .zip(self.high.as_ref())
            .is_none_or(|((k, _), high)| k <= high);
        Leaf {
            next: next.filter(|_| more),
            entries: entries.into_iter(),
        }
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
            match self.seek() {
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

/// The values for one key, in insertion order. See `IndexReader::get`.
pub struct Values<'r>(Entries<'r>);

impl Iterator for Values<'_> {
    type Item = io::Result<u64>;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|entry| entry.map(|(_, value)| value))
    }
}

#[cfg(test)]
mod tests {
    use super::super::tests::index;

    #[test]
    fn hot_leaf_loads_the_call_after_stepping_onto_a_leaf() {
        let index = index((0..2000).map(|v| ("same", v)));
        let mut entries = index.iter();
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
        let keys: Vec<_> = (0..1000).map(|k| format!("k{k:04}")).collect();
        let index = index(keys.iter().zip(0..).map(|(k, v)| (k.as_str(), v)));
        let mut values = index.get("k0000");
        assert_eq!(values.next().unwrap().unwrap(), 0);
        assert!(values.0.current.as_ref().unwrap().next.is_none());
        assert!(values.next().is_none());
        assert!(values.0.hot.is_none());
    }
}
