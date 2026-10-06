use std::collections::HashMap;
use std::fs::File;
use std::io::{Error, Write};
use std::path::PathBuf;

use crate::disk::readers::{AsyncReader, Record, report};
use crate::disk::writer::JoinWriter;
use crate::join::Join;

/// Hash join: maps every B row by key, then probes the map with each A row.
/// Output follows A's order, then B's order within a key, the same as LOOP.
/// The map holds all of B, so `max_memory` bounds only the read batches.
pub struct HashJoin {
    file_a: AsyncReader,
    file_b: AsyncReader,
}

impl HashJoin {
    pub fn create(path_a: PathBuf, path_b: PathBuf, max_memory: usize) -> Result<Self, Error> {
        let max_memory = max_memory / 2;
        Ok(HashJoin {
            file_a: AsyncReader::new(File::open(&path_a)?, max_memory)
                .named(path_a.display().to_string()),
            file_b: AsyncReader::new(File::open(&path_b)?, max_memory)
                .named(path_b.display().to_string()),
        })
    }
}

impl HashJoin {
    fn join<W: Write>(&mut self, mut out: JoinWriter<W>) -> anyhow::Result<()> {
        let mut map: HashMap<String, Vec<Record>> = HashMap::new();
        for record in &mut self.file_b {
            let r = record?;
            map.entry(r.key().to_string()).or_default().push(r);
        }
        for record in &mut self.file_a {
            let a = record?;
            if let Some(b) = map.get(a.key()) {
                for b in b {
                    out.write(Record::joined(&a, b))?;
                }
            }
        }
        out.finish()?;
        Ok(())
    }
}

impl Join for HashJoin {
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

    impl FromBytes for HashJoin {
        fn from_bytes(a: impl Read + Send + 'static, b: &[u8], max_memory: usize) -> Self {
            HashJoin {
                file_a: AsyncReader::new(a, max_memory).named("a.csv"),
                file_b: AsyncReader::new(Cursor::new(b.to_vec()), max_memory).named("b.csv"),
            }
        }
    }

    #[test]
    fn each_bucket_keeps_b_order_when_b_interleaves_keys() {
        let (result, output) =
            try_join::<HashJoin>(b"2,b\n1,a\n", b"1,x1\n2,y1\n1,x2\n2,y2\n", 1024);
        result.unwrap();
        assert_eq!(output, "2,b,y1\n2,b,y2\n1,a,x1\n1,a,x2\n");
    }
}
