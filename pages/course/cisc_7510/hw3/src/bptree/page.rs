//! Page reader and writer: one B+ tree node per fixed size page.
//!
//! Layout, little endian:
//!
//! - tag (`u8`): 1 for a leaf, 2 for an internal node.
//! - count (`u16`): entries in a leaf, or separator keys in an internal node.
//! - `u64`: a leaf's next leaf id (`u64::MAX` for none), or an internal node's
//!   first child id.
//! - count times: key length (`u16`), key bytes, then a `u64` value (leaf) or
//!   the child to the right of that key (internal).
//!
//! The rest of the page is zero.

use std::fs::File;
use std::io;

/// Bytes in one page, both on disk and as counted against the pool budget.
pub const PAGE_SIZE: usize = 4096;

/// Bytes before the first entry: tag, entry count, and next leaf or first child.
pub const HEADER: usize = 1 + 2 + 8;

const LEAF: u8 = 1;
const INTERNAL: u8 = 2;
const NO_PAGE: u64 = u64::MAX;

/// A page's position in the spill file, in units of `PAGE_SIZE`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct PageId(pub u64);

/// One B+ tree node, as held in a page.
///
/// An internal node has one more child than keys. Every key under
/// `children[i]` is at most `keys[i]`, and every key under `children[i + 1]`
/// is at least `keys[i]`, so equal keys may sit on both sides.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Node {
    Leaf {
        entries: Vec<(String, u64)>,
        next: Option<PageId>,
    },
    Internal {
        keys: Vec<String>,
        children: Vec<PageId>,
    },
}

/// Bytes one key and its value or child id take in a page.
pub fn entry_len(key: &str) -> usize {
    2 + key.len() + 8
}

/// Bytes `node` takes when encoded. A node fits in a page when this is at
/// most `PAGE_SIZE`.
pub fn encoded_len(node: &Node) -> usize {
    let entries: usize = match node {
        Node::Leaf { entries, .. } => entries.iter().map(|(k, _)| entry_len(k)).sum(),
        Node::Internal { keys, .. } => keys.iter().map(|k| entry_len(k)).sum(),
    };
    HEADER + entries
}

/// Write `node` into `buf`, zeroing the unused tail. Fails with
/// `InvalidInput` when the node does not fit in one page.
pub fn encode(node: &Node, buf: &mut [u8; PAGE_SIZE]) -> io::Result<()> {
    let len = encoded_len(node);
    if len > PAGE_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("node needs {len} bytes, over the {PAGE_SIZE} byte page"),
        ));
    }
    let mut out = Writer { buf, at: 0 };
    match node {
        Node::Leaf { entries, next } => {
            out.put(&[LEAF]);
            out.put(&(entries.len() as u16).to_le_bytes());
            out.put(&next.map_or(NO_PAGE, |id| id.0).to_le_bytes());
            for (key, value) in entries {
                out.key(key);
                out.put(&value.to_le_bytes());
            }
        }
        Node::Internal { keys, children } => {
            debug_assert_eq!(children.len(), keys.len() + 1);
            out.put(&[INTERNAL]);
            out.put(&(keys.len() as u16).to_le_bytes());
            out.put(&children[0].0.to_le_bytes());
            for (key, child) in keys.iter().zip(&children[1..]) {
                out.key(key);
                out.put(&child.0.to_le_bytes());
            }
        }
    }
    let at = out.at;
    buf[at..].fill(0);
    Ok(())
}

/// Parse the node in `buf`. Fails with `InvalidData` on an unknown tag, an
/// entry running past the page, or a key that is not UTF-8.
pub fn decode(buf: &[u8; PAGE_SIZE]) -> io::Result<Node> {
    let mut input = Reader { buf, at: 0 };
    let tag = input.take(1)?[0];
    let count = input.u16()? as usize;
    let first = input.u64()?;
    match tag {
        LEAF => {
            let mut entries = Vec::with_capacity(count);
            for _ in 0..count {
                let key = input.key()?;
                entries.push((key, input.u64()?));
            }
            let next = (first != NO_PAGE).then_some(PageId(first));
            Ok(Node::Leaf { entries, next })
        }
        INTERNAL => {
            let mut keys = Vec::with_capacity(count);
            let mut children = Vec::with_capacity(count + 1);
            children.push(PageId(first));
            for _ in 0..count {
                keys.push(input.key()?);
                children.push(PageId(input.u64()?));
            }
            Ok(Node::Internal { keys, children })
        }
        _ => Err(invalid_data(format!("unknown page tag {tag}"))),
    }
}

/// Read and parse page `id` from `file`. Positioned reads need only `&File`,
/// so any number of readers may share one handle.
pub fn read_at(file: &File, id: PageId) -> io::Result<Node> {
    let mut buf = [0u8; PAGE_SIZE];
    read_exact_at(file, &mut buf, id.0 * PAGE_SIZE as u64)?;
    decode(&buf)
}

/// Encode `node` and write it as page `id` of `file`.
pub fn write_at(file: &File, id: PageId, node: &Node) -> io::Result<()> {
    let mut buf = [0u8; PAGE_SIZE];
    encode(node, &mut buf)?;
    write_all_at(file, &buf, id.0 * PAGE_SIZE as u64)
}

#[cfg(unix)]
fn read_exact_at(file: &File, buf: &mut [u8], offset: u64) -> io::Result<()> {
    std::os::unix::fs::FileExt::read_exact_at(file, buf, offset)
}

#[cfg(unix)]
fn write_all_at(file: &File, buf: &[u8], offset: u64) -> io::Result<()> {
    std::os::unix::fs::FileExt::write_all_at(file, buf, offset)
}

/// Windows positioned reads also move the file cursor, which is harmless
/// here: every access passes its own offset. They may return short, so loop.
#[cfg(windows)]
fn read_exact_at(file: &File, mut buf: &mut [u8], mut offset: u64) -> io::Result<()> {
    use std::os::windows::fs::FileExt;
    while !buf.is_empty() {
        match file.seek_read(buf, offset) {
            Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
            Ok(n) => {
                buf = &mut buf[n..];
                offset += n as u64;
            }
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

#[cfg(windows)]
fn write_all_at(file: &File, mut buf: &[u8], mut offset: u64) -> io::Result<()> {
    use std::os::windows::fs::FileExt;
    while !buf.is_empty() {
        match file.seek_write(buf, offset) {
            Ok(0) => return Err(io::ErrorKind::WriteZero.into()),
            Ok(n) => {
                buf = &buf[n..];
                offset += n as u64;
            }
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

fn invalid_data(msg: String) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, msg)
}

/// Appends to a page. `encode` checks the length first, so writes never
/// run past the end.
struct Writer<'a> {
    buf: &'a mut [u8; PAGE_SIZE],
    at: usize,
}

impl Writer<'_> {
    fn put(&mut self, bytes: &[u8]) {
        self.buf[self.at..self.at + bytes.len()].copy_from_slice(bytes);
        self.at += bytes.len();
    }

    fn key(&mut self, key: &str) {
        self.put(&(key.len() as u16).to_le_bytes());
        self.put(key.as_bytes());
    }
}

/// Consumes a page front to back, failing rather than reading past the end.
struct Reader<'a> {
    buf: &'a [u8; PAGE_SIZE],
    at: usize,
}

impl Reader<'_> {
    fn take(&mut self, n: usize) -> io::Result<&[u8]> {
        let bytes = self
            .buf
            .get(self.at..self.at + n)
            .ok_or_else(|| invalid_data(format!("page entry runs past byte {PAGE_SIZE}")))?;
        self.at += n;
        Ok(bytes)
    }

    fn u16(&mut self) -> io::Result<u16> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().unwrap()))
    }

    fn u64(&mut self) -> io::Result<u64> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }

    fn key(&mut self) -> io::Result<String> {
        let len = self.u16()? as usize;
        let bytes = self.take(len)?.to_vec();
        String::from_utf8(bytes).map_err(|e| invalid_data(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trip(node: &Node) -> Node {
        let mut buf = [0u8; PAGE_SIZE];
        encode(node, &mut buf).unwrap();
        decode(&buf).unwrap()
    }

    #[test]
    fn leaf_round_trips() {
        let node = Node::Leaf {
            entries: vec![("a".into(), 1), ("a".into(), 2), ("b".into(), 3)],
            next: Some(PageId(7)),
        };
        assert_eq!(round_trip(&node), node);
    }

    #[test]
    fn internal_round_trips() {
        let node = Node::Internal {
            keys: vec!["m".into(), "t".into()],
            children: vec![PageId(1), PageId(2), PageId(u64::MAX - 1)],
        };
        assert_eq!(round_trip(&node), node);
    }

    #[test]
    fn empty_leaf_round_trips() {
        let node = Node::Leaf {
            entries: vec![],
            next: None,
        };
        assert_eq!(round_trip(&node), node);
    }

    #[test]
    fn encoded_len_counts_header_and_entries() {
        let node = Node::Leaf {
            entries: vec![("abc".into(), 1)],
            next: None,
        };
        assert_eq!(encoded_len(&node), HEADER + 2 + 3 + 8);
    }

    #[test]
    fn overfull_node_is_invalid_input() {
        let entries = (0..PAGE_SIZE / 10)
            .map(|i| (format!("{i:04}"), i as u64))
            .collect();
        let node = Node::Leaf {
            entries,
            next: None,
        };
        assert!(encoded_len(&node) > PAGE_SIZE);
        let mut buf = [0u8; PAGE_SIZE];
        let err = encode(&node, &mut buf).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
    }

    #[test]
    fn unknown_tag_is_invalid_data() {
        let mut buf = [0u8; PAGE_SIZE];
        buf[0] = 0xff;
        assert_eq!(decode(&buf).unwrap_err().kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn truncated_entries_are_invalid_data() {
        let mut buf = [0u8; PAGE_SIZE];
        encode(
            &Node::Leaf {
                entries: vec![],
                next: None,
            },
            &mut buf,
        )
        .unwrap();
        buf[1..3].copy_from_slice(&u16::MAX.to_le_bytes());
        assert_eq!(decode(&buf).unwrap_err().kind(), io::ErrorKind::InvalidData);
    }
}
