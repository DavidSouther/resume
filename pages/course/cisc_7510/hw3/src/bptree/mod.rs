//! A disk-backed B+ tree index from string keys to `u64` values, for HASH's
//! key index.
//!
//! An `IndexBuilder` takes inserts, keeping resident pages under a budget in
//! a buffer pool and spilling the rest to a scratch file. `finish` writes
//! every page out and returns an `IndexReader`, whose cursors read leaves
//! straight from that file.

use std::path::PathBuf;

mod builder;
mod page;
mod pool;
mod reader;

pub use builder::IndexBuilder;
pub use pool::MIN_PAGES;
pub use reader::{Entries, IndexReader, Values};

/// Longest key `insert` accepts, in bytes. It keeps at least four entries in
/// a page, so every split leaves both halves within a page.
pub const MAX_KEY_LEN: usize = 1000;

/// Removes the spill file when dropped. Passes from builder to reader, so
/// the file lives exactly as long as the index does.
struct SpillPath(PathBuf);

impl Drop for SpillPath {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

#[cfg(test)]
mod tests {
    use super::page::PAGE_SIZE;
    use super::*;
    use std::io;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A spill file path unique to this process and call. Unit tests do not
    /// get `CARGO_TARGET_TMPDIR`, so use the system temp directory.
    pub(super) fn tmp_path() -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("csv_join_bptree_{}_{n}.pages", std::process::id()))
    }

    pub(super) fn builder(pages: usize) -> IndexBuilder {
        IndexBuilder::create(&tmp_path(), pages * PAGE_SIZE).unwrap()
    }

    /// An index at the minimum budget holding `entries`, inserted in order.
    pub(super) fn index<'k>(entries: impl IntoIterator<Item = (&'k str, u64)>) -> IndexReader {
        let mut builder = builder(MIN_PAGES);
        for (key, value) in entries {
            builder.insert(key, value).unwrap();
        }
        builder.finish().unwrap()
    }

    fn values(index: &IndexReader, key: &str) -> Vec<u64> {
        index.get(key).collect::<io::Result<_>>().unwrap()
    }

    #[test]
    fn duplicates_span_leaves_in_insertion_order() {
        let index = index((0..2000).map(|v| ("same", v)));
        assert_eq!(values(&index, "same"), (0..2000).collect::<Vec<_>>());
    }

    #[test]
    fn absent_key_is_empty() {
        assert!(values(&index([]), "missing").is_empty());
        assert!(index([]).iter().next().is_none());
        let keys: Vec<_> = (0..1000).map(|v| format!("k{v:04}")).collect();
        let index = index(keys.iter().zip(0..).map(|(k, v)| (k.as_str(), v)));
        assert!(values(&index, "missing").is_empty());
        assert!(values(&index, "k").is_empty());
        assert!(values(&index, "k0500x").is_empty());
    }

    // Triangulate the insert order: the newest leaf splits at the right
    // edge, the left edge, and anywhere between, and both `get` and `iter`
    // still see every entry by key, then by insertion.

    fn check_order(order: impl Iterator<Item = u64>) {
        let mut builder = builder(MIN_PAGES);
        for k in order {
            builder.insert(&format!("key{k:04}"), k).unwrap();
            builder.insert(&format!("key{k:04}"), k + 10_000).unwrap();
        }
        let index = builder.finish().unwrap();
        for k in 0..3000 {
            assert_eq!(values(&index, &format!("key{k:04}")), vec![k, k + 10_000]);
        }
        let entries: Vec<_> = index.iter().collect::<io::Result<_>>().unwrap();
        let expected: Vec<_> = (0..3000)
            .flat_map(|k| [k, k + 10_000].map(|v| (format!("key{k:04}"), v)))
            .collect();
        assert_eq!(entries, expected);
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
        let keys: Vec<_> = (0..200u64)
            .map(|k| format!("{k:0>width$}", width = MAX_KEY_LEN))
            .collect();
        let index = index(keys.iter().zip(0..).map(|(k, v)| (k.as_str(), v)));
        for (k, key) in keys.iter().enumerate() {
            assert_eq!(values(&index, key), vec![k as u64]);
        }
    }

    #[test]
    fn cursors_read_side_by_side() {
        let keys: Vec<_> = (0..1000).map(|k| format!("k{k:04}")).collect();
        let index = index(keys.iter().flat_map(|k| [(k.as_str(), 1), (k.as_str(), 2)]));
        let mut all = index.iter();
        let mut last = index.get("k0999");
        assert_eq!(all.next().unwrap().unwrap(), ("k0000".to_string(), 1));
        assert_eq!(last.next().unwrap().unwrap(), 1);
        assert_eq!(all.next().unwrap().unwrap(), ("k0000".to_string(), 2));
        assert_eq!(last.next().unwrap().unwrap(), 2);
        assert!(last.next().is_none());
        assert_eq!(all.count(), 1998);
    }

    #[test]
    fn oversize_key_is_invalid_input() {
        let mut builder = builder(MIN_PAGES);
        let err = builder.insert(&"x".repeat(MAX_KEY_LEN + 1), 1).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn budget_below_min_pages_is_invalid_input() {
        let budget = MIN_PAGES * PAGE_SIZE - 1;
        let err = IndexBuilder::create(&tmp_path(), budget).err().unwrap();
        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn dropping_the_builder_removes_the_spill_file() {
        let path = tmp_path();
        let mut builder = IndexBuilder::create(&path, MIN_PAGES * PAGE_SIZE).unwrap();
        builder.insert("a", 1).unwrap();
        assert!(path.exists());
        drop(builder);
        assert!(!path.exists());
    }

    #[test]
    fn the_reader_keeps_the_spill_file_until_dropped() {
        let path = tmp_path();
        let mut builder = IndexBuilder::create(&path, MIN_PAGES * PAGE_SIZE).unwrap();
        builder.insert("a", 1).unwrap();
        let index = builder.finish().unwrap();
        assert!(path.exists());
        assert_eq!(values(&index, "a"), [1]);
        drop(index);
        assert!(!path.exists());
    }
}
