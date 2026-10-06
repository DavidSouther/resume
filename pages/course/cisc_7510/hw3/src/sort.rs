//! Sorts CSV files on their key through a B+ tree index, for SORT-MERGE.

use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, BufWriter, Cursor, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use crate::bptree::IndexBuilder;

/// A source of rows sorted on the key, ready for MERGE.
pub type SortedRows = Box<dyn Read + Send>;

/// Sorts A and B for MERGE, in memory when a file fits its budget.
pub struct Sorter {
    path_a: PathBuf,
    path_b: PathBuf,
    max_memory: usize,
    index_memory: usize,
}

impl Sorter {
    /// A file of at most half of `max_memory` bytes sorts in memory. Each
    /// larger file's key index holds at most `index_memory` bytes of
    /// resident pages. The files are sorted one after the other, so each
    /// gets the whole index budget.
    pub fn create(
        path_a: PathBuf,
        path_b: PathBuf,
        max_memory: usize,
        index_memory: usize,
    ) -> Self {
        Sorter {
            path_a,
            path_b,
            max_memory,
            index_memory,
        }
    }

    /// Return A's and B's rows sorted on the key. A file over its budget is
    /// sorted to `out/a.csv` or `out/b.csv`, creating `out` if needed, with
    /// index pages spilling to `out` while sorting.
    pub fn run(self, out: &Path) -> io::Result<(SortedRows, SortedRows)> {
        let budget = self.max_memory / 2;
        let a = sort_into(&self.path_a, out, "a", budget, self.index_memory)?;
        let b = sort_into(&self.path_b, out, "b", budget, self.index_memory)?;
        Ok((a, b))
    }
}

/// Sort `input` into memory when it is at most `budget` bytes, and otherwise
/// to `out/<stem>.csv`. Index pages spill to `out/<stem>.pages` either way.
fn sort_into(
    input: &Path,
    out: &Path,
    stem: &str,
    budget: usize,
    index_memory: usize,
) -> io::Result<SortedRows> {
    fs::create_dir_all(out)?;
    let pages = out.join(format!("{stem}.pages"));
    if fs::metadata(input)?.len() <= budget as u64 {
        let mut rows = Vec::new();
        sort(input, &mut rows, &pages, index_memory)?;
        return Ok(Box::new(Cursor::new(rows)));
    }
    let output = out.join(format!("{stem}.csv"));
    sort(
        input,
        BufWriter::new(File::create(&output)?),
        &pages,
        index_memory,
    )?;
    Ok(Box::new(File::open(output)?))
}

/// Copy `input` to `output` with its rows ordered by key, then by file
/// order, ending every row with a newline.
///
/// Builds an index from each row's key to its byte offset, spilling pages
/// to `pages`, then copies the rows in index order. Keys that are not UTF-8
/// are indexed lossily, so those rows land in an arbitrary place.
fn sort(input: &Path, mut output: impl Write, pages: &Path, index_memory: usize) -> io::Result<()> {
    let mut input = BufReader::new(File::open(input)?);
    let mut builder = IndexBuilder::create(pages, index_memory)?;
    let mut row = Vec::new();
    let mut offset = 0;
    loop {
        row.clear();
        let len = input.read_until(b'\n', &mut row)?;
        if len == 0 {
            break;
        }
        let key = row.split(|&b| b == b',' || b == b'\n').next().unwrap();
        builder.insert(&String::from_utf8_lossy(key), offset)?;
        offset += len as u64;
    }
    let index = builder.finish()?;

    for entry in index.iter() {
        let (_, offset) = entry?;
        input.seek(SeekFrom::Start(offset))?;
        row.clear();
        input.read_until(b'\n', &mut row)?;
        if row.last() != Some(&b'\n') {
            row.push(b'\n');
        }
        output.write_all(&row)?;
    }
    output.flush()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orders_rows_by_key_then_file_order() {
        let dir = std::env::temp_dir().join(format!("csv_join_sort_test_{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("in.csv");
        fs::write(&input, "b,1\na,1\nb,2\nab\na,2").unwrap();
        let mut sorted = Vec::new();
        sort(&input, &mut sorted, &dir.join("in.pages"), 1 << 20).unwrap();
        fs::remove_dir_all(&dir).unwrap();
        assert_eq!(sorted, b"a,1\na,2\nab\nb,1\nb,2\n");
    }

    fn read_all(mut reader: Box<dyn Read + Send>) -> String {
        let mut rows = String::new();
        reader.read_to_string(&mut rows).unwrap();
        rows
    }

    // Bifurcate the budget: inputs that fit sort into memory and leave no
    // sorted copy in `out`, and larger inputs write one, with the same rows
    // either way.

    #[test]
    fn inputs_within_budget_sort_in_memory_and_larger_ones_spill() {
        let dir = std::env::temp_dir().join(format!("csv_join_sorter_test_{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let (a, b) = (dir.join("a.csv"), dir.join("b.csv"));
        fs::write(&a, "b,1\na,1\nb,2\nab\na,2").unwrap();
        fs::write(&b, "2,y\n1,x\n").unwrap();
        let expected = ("a,1\na,2\nab\nb,1\nb,2\n", "1,x\n2,y\n");

        let out = dir.join("memory");
        let (sa, sb) = Sorter::create(a.clone(), b.clone(), 1 << 20, 1 << 20)
            .run(&out)
            .unwrap();
        assert_eq!((read_all(sa).as_str(), read_all(sb).as_str()), expected);
        assert!(fs::read_dir(&out).unwrap().next().is_none());

        let out = dir.join("spill");
        let (sa, sb) = Sorter::create(a, b, 0, 1 << 20).run(&out).unwrap();
        assert_eq!((read_all(sa).as_str(), read_all(sb).as_str()), expected);
        assert!(out.join("a.csv").exists() && out.join("b.csv").exists());

        fs::remove_dir_all(&dir).unwrap();
    }
}
