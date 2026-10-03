//! Buffer pool: keeps a bounded number of decoded pages resident and spills
//! the rest to a scratch file.

use std::collections::{HashMap, VecDeque};
use std::fs::{File, OpenOptions};
use std::io;
use std::path::Path;

use super::page::{self, Node, PAGE_SIZE, PageId};

/// Fewest pages a pool may hold: a page being split plus its new sibling.
/// Callers never hold a page across calls, so the rest of a root to leaf
/// path may be evicted and reloaded.
pub const MIN_PAGES: usize = 2;

struct Frame {
    node: Node,
    dirty: bool,
}

/// Resident pages, at most `max_memory / PAGE_SIZE` of them, backed by a
/// spill file of raw pages addressed by `PageId`.
///
/// The budget bounds resident page bytes only, counted as `PAGE_SIZE` per
/// resident page. The page table, LRU order, and temporary buffers are extra.
/// Evicting the least recently used page writes it back only when it changed
/// since it was last loaded.
pub struct Pool {
    file: File,
    frames: HashMap<PageId, Frame>,
    lru: VecDeque<PageId>,
    capacity: usize,
    next_id: u64,
    peak_resident: usize,
    pages_written: usize,
}

impl Pool {
    /// Create or truncate the spill file at `path`. Fails with `InvalidInput`
    /// when `max_memory` holds fewer than `MIN_PAGES` pages.
    pub fn create(path: &Path, max_memory: usize) -> io::Result<Pool> {
        let capacity = max_memory / PAGE_SIZE;
        if capacity < MIN_PAGES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!(
                    "page budget of {max_memory} bytes is under the {} byte minimum",
                    MIN_PAGES * PAGE_SIZE
                ),
            ));
        }
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .open(path)?;
        Ok(Pool {
            file,
            frames: HashMap::with_capacity(capacity),
            lru: VecDeque::with_capacity(capacity),
            capacity,
            next_id: 0,
            peak_resident: 0,
            pages_written: 0,
        })
    }

    /// Add `node` as a new resident page. It reaches the spill file only when
    /// evicted.
    pub fn allocate(&mut self, node: Node) -> io::Result<PageId> {
        let id = PageId(self.next_id);
        self.next_id += 1;
        self.insert(id, Frame { node, dirty: true })?;
        Ok(id)
    }

    /// The node in page `id`, loading it from the spill file if it is not
    /// resident.
    pub fn read(&mut self, id: PageId) -> io::Result<&Node> {
        Ok(&self.frame(id)?.node)
    }

    /// The node in page `id` for changing in place. The page is written back
    /// when evicted.
    pub fn write(&mut self, id: PageId) -> io::Result<&mut Node> {
        let frame = self.frame(id)?;
        frame.dirty = true;
        Ok(&mut frame.node)
    }

    /// Most bytes of pages resident at once over the pool's life.
    pub fn peak_resident_bytes(&self) -> usize {
        self.peak_resident
    }

    /// Pages written to the spill file over the pool's life.
    pub fn pages_written(&self) -> usize {
        self.pages_written
    }

    /// Write every changed resident page, so the spill file holds every page.
    pub fn flush(&mut self) -> io::Result<()> {
        for (&id, frame) in &mut self.frames {
            if frame.dirty {
                page::write_at(&self.file, id, &frame.node)?;
                self.pages_written += 1;
                frame.dirty = false;
            }
        }
        Ok(())
    }

    /// Give up the resident pages and return the spill file. Call `flush`
    /// first, or changed pages are lost.
    pub fn into_file(self) -> File {
        self.file
    }

    fn frame(&mut self, id: PageId) -> io::Result<&mut Frame> {
        if self.frames.contains_key(&id) {
            self.touch(id);
        } else {
            let node = page::read_at(&self.file, id)?;
            self.insert(id, Frame { node, dirty: false })?;
        }
        Ok(self
            .frames
            .get_mut(&id)
            .expect("frame was just made resident"))
    }

    fn insert(&mut self, id: PageId, frame: Frame) -> io::Result<()> {
        while self.frames.len() >= self.capacity {
            self.evict()?;
        }
        self.frames.insert(id, frame);
        self.lru.push_back(id);
        self.peak_resident = self.peak_resident.max(self.frames.len() * PAGE_SIZE);
        Ok(())
    }

    fn touch(&mut self, id: PageId) {
        if let Some(at) = self.lru.iter().position(|&i| i == id) {
            self.lru.remove(at);
        }
        self.lru.push_back(id);
    }

    /// Drop the least recently used page, writing it first if dirty. On a
    /// write error the page stays resident.
    fn evict(&mut self) -> io::Result<()> {
        let id = *self.lru.front().expect("a full pool has pages to evict");
        let frame = &self.frames[&id];
        if frame.dirty {
            page::write_at(&self.file, id, &frame.node)?;
            self.pages_written += 1;
        }
        self.lru.pop_front();
        self.frames.remove(&id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A spill file path unique to this process and call. Unit tests do not
    /// get `CARGO_TARGET_TMPDIR`, so use the system temp directory.
    fn tmp_path() -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("csv_join_pool_{}_{n}.pages", std::process::id()))
    }

    fn leaf_with(i: usize) -> Node {
        Node::Leaf {
            entries: vec![(format!("k{i}"), i as u64)],
            next: None,
        }
    }

    /// A pool at the minimum budget. Its spill file is unlinked at once; the
    /// open handle keeps it usable on Unix, and nothing is left behind.
    fn pool() -> Pool {
        let path = tmp_path();
        let pool = Pool::create(&path, MIN_PAGES * PAGE_SIZE).unwrap();
        let _ = std::fs::remove_file(&path);
        pool
    }

    #[test]
    fn evicts_lru_and_reloads_from_disk() {
        let mut pool = pool();
        let ids: Vec<_> = (0..MIN_PAGES + 3)
            .map(|i| pool.allocate(leaf_with(i)).unwrap())
            .collect();
        assert!(pool.pages_written() > 0);
        assert!(pool.peak_resident_bytes() <= MIN_PAGES * PAGE_SIZE);
        assert_eq!(pool.read(ids[0]).unwrap(), &leaf_with(0));
    }

    #[test]
    fn budget_below_min_pages_is_invalid_input() {
        let err = Pool::create(&tmp_path(), MIN_PAGES * PAGE_SIZE - 1)
            .err()
            .unwrap();
        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn clean_eviction_writes_nothing() {
        let mut pool = pool();
        let ids: Vec<_> = (0..2 * MIN_PAGES)
            .map(|i| pool.allocate(leaf_with(i)).unwrap())
            .collect();
        // Reloading the first half evicts, and so writes, the dirty second half.
        for &id in &ids[..MIN_PAGES] {
            pool.read(id).unwrap();
        }
        let written = pool.pages_written();
        for &id in &ids[MIN_PAGES..] {
            pool.read(id).unwrap();
        }
        assert_eq!(pool.pages_written(), written);
    }

    #[test]
    fn written_page_survives_eviction() {
        let mut pool = pool();
        let first = pool.allocate(leaf_with(0)).unwrap();
        for i in 1..=MIN_PAGES {
            pool.allocate(leaf_with(i)).unwrap();
        }
        *pool.write(first).unwrap() = leaf_with(99);
        for i in 0..MIN_PAGES {
            pool.allocate(leaf_with(i)).unwrap();
        }
        assert!(!pool.frames.contains_key(&first));
        assert_eq!(pool.read(first).unwrap(), &leaf_with(99));
    }

    #[test]
    fn recently_read_page_is_not_the_next_victim() {
        let mut pool = pool();
        let ids: Vec<_> = (0..MIN_PAGES)
            .map(|i| pool.allocate(leaf_with(i)).unwrap())
            .collect();
        pool.read(ids[0]).unwrap();
        pool.allocate(leaf_with(MIN_PAGES)).unwrap();
        assert!(pool.frames.contains_key(&ids[0]));
        assert!(!pool.frames.contains_key(&ids[1]));
    }

    #[test]
    fn flush_writes_each_changed_page_once() {
        let mut pool = pool();
        let ids: Vec<_> = (0..MIN_PAGES)
            .map(|i| pool.allocate(leaf_with(i)).unwrap())
            .collect();
        pool.flush().unwrap();
        assert_eq!(pool.pages_written(), MIN_PAGES);
        pool.flush().unwrap();
        assert_eq!(pool.pages_written(), MIN_PAGES);
        let file = pool.into_file();
        for (i, &id) in ids.iter().enumerate() {
            assert_eq!(page::read_at(&file, id).unwrap(), leaf_with(i));
        }
    }

    #[test]
    fn resident_bytes_peak_at_the_budget() {
        let mut pool = pool();
        for i in 0..10 * MIN_PAGES {
            pool.allocate(leaf_with(i)).unwrap();
        }
        assert_eq!(pool.peak_resident_bytes(), MIN_PAGES * PAGE_SIZE);
    }
}
