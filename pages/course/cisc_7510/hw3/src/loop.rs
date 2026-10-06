use std::fs::File;
use std::io::{Error, Write};
use std::path::PathBuf;

use crate::disk::readers::{AsyncReader, Record, SmallReader, report};
use crate::disk::writer::JoinWriter;
use crate::join::Join;

/// Nested loop join: B is loaded whole once, then scanned for every A row.
/// Output follows A's order, then B's order for each A row. `max_memory`
/// bounds only A's batches.
pub struct LoopJoin {
    file_a: AsyncReader,
    file_b: SmallReader,
}

impl LoopJoin {
    pub fn create(path_a: PathBuf, path_b: PathBuf, max_memory: usize) -> Result<Self, Error> {
        Ok(LoopJoin {
            file_a: AsyncReader::new(File::open(&path_a)?, max_memory)
                .named(path_a.display().to_string()),
            file_b: SmallReader::new(File::open(&path_b)?)?.named(path_b.display().to_string()),
        })
    }
}

impl LoopJoin {
    fn join<W: Write>(&mut self, mut out: JoinWriter<W>) -> anyhow::Result<()> {
        for record in &mut self.file_a {
            let a = record?;
            for b in self.file_b.records() {
                if a.key() == b.key() {
                    out.write(Record::joined(&a, &b))?;
                }
            }
        }
        out.finish()?;
        Ok(())
    }
}

impl Join for LoopJoin {
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
    use crate::join::tests::FromBytes;
    use std::io::{Cursor, Read};

    impl FromBytes for LoopJoin {
        fn from_bytes(a: impl Read + Send + 'static, b: &[u8], max_memory: usize) -> Self {
            LoopJoin {
                file_a: AsyncReader::new(a, max_memory).named("a.csv"),
                file_b: SmallReader::new(Cursor::new(b)).unwrap().named("b.csv"),
            }
        }
    }
}
