use std::{
    fs::File,
    io::{Read, Write},
    path::PathBuf,
};

use crate::{
    disk::{
        readers::{AsyncReader, Record, report},
        writer::JoinWriter,
    },
    join::Join,
};

/// Merge join over inputs already sorted byte-wise on the key. Takes each key
/// group from A, advances B to the matching group, and writes their cross
/// product with A outer and B inner. Unsorted input silently loses matches.
///
/// B is read only as far as the first key past A's last key, so bad rows in
/// B's unread tail are never seen and go unreported.
pub struct MergeJoin {
    file_a: AsyncReader,
    file_b: AsyncReader,
}

impl MergeJoin {
    pub fn from_paths(
        path_a: PathBuf,
        path_b: PathBuf,
        max_memory: usize,
    ) -> std::io::Result<Self> {
        Ok(Self::from_readers(
            (File::open(&path_a)?, path_a.display().to_string()),
            (File::open(&path_b)?, path_b.display().to_string()),
            max_memory,
        ))
    }

    /// Merge two sorted sources, each paired with the name its skips report.
    /// Each source gets half of `max_memory`.
    pub fn from_readers(
        (a, name_a): (impl Read + Send + 'static, String),
        (b, name_b): (impl Read + Send + 'static, String),
        max_memory: usize,
    ) -> Self {
        let max_memory = max_memory / 2;
        MergeJoin {
            file_a: AsyncReader::new(a, max_memory).named(name_a),
            file_b: AsyncReader::new(b, max_memory).named(name_b),
        }
    }
}

impl MergeJoin {
    fn join<W: Write>(&mut self, mut out: JoinWriter<W>) -> anyhow::Result<()> {
        while let Some(a_group) = self.file_a.next_group().transpose()? {
            let Some(b_group) = self.file_b.next_matching(a_group[0].key()).transpose()? else {
                continue;
            };
            for a in &a_group {
                for b in &b_group {
                    out.write(Record::joined(a, b))?;
                }
            }
        }

        out.finish()?;
        Ok(())
    }
}

impl Join for MergeJoin {
    fn run<W: Write>(mut self, out: JoinWriter<W>) -> anyhow::Result<()> {
        let result = self.join(out);
        let mut skipped = self.file_a.take_skipped();
        skipped.extend(self.file_b.take_skipped());
        report(result, skipped)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::join::tests::{FromBytes, try_join};
    use std::io::{Cursor, Read};

    impl FromBytes for MergeJoin {
        fn from_bytes(a: impl Read + Send + 'static, b: &[u8], max_memory: usize) -> Self {
            MergeJoin {
                file_a: AsyncReader::new(a, max_memory).named("a.csv"),
                file_b: AsyncReader::new(Cursor::new(b.to_vec()), max_memory).named("b.csv"),
            }
        }
    }

    fn join(a: &str, b: &str, max_memory: usize) -> String {
        let (result, output) = try_join::<MergeJoin>(a.as_bytes(), b.as_bytes(), max_memory);
        result.unwrap();
        output
    }

    // Bifurcate the batching: groups and skipped keys that cross batch
    // boundaries join the same as when every row sits in one batch.

    #[test]
    fn output_does_not_depend_on_the_memory_budget() {
        let a = "1,a\n2,b1\n2,b2\n4,d\n6,f\n";
        let b = "0,v\n2,x1\n2,x2\n3,y\n6,z\n";
        let whole = join(a, b, 1 << 20);
        assert_eq!(whole, "2,b1,x1\n2,b1,x2\n2,b2,x1\n2,b2,x2\n6,f,z\n");
        assert_eq!(join(a, b, 1), whole);
        assert_eq!(join(a, b, 16), whole);
    }

    #[test]
    fn a_bad_b_row_past_the_last_a_key_goes_unreported() {
        // One row per batch, so B's batches past `2,y` are never received.
        let (result, output) = try_join::<MergeJoin>(b"1,a\n", b"1,x\n2,y\n3,\xff\n", 1);
        assert_eq!(output, "1,a,x\n");
        result.unwrap();
    }
}
