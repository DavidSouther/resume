use std::{eprintln, error::Error, fs::File, io::Write, path::PathBuf};

use crate::{
    join::Join,
    readers::{AsyncReader, Record},
    writer::JoinWriter,
};

pub struct MergeJoin {
    file_a: AsyncReader,
    file_b: AsyncReader,
}

impl MergeJoin {
    pub fn create(path_a: PathBuf, path_b: PathBuf, max_memory: usize) -> std::io::Result<Self> {
        let max_memory = max_memory / 2;
        Ok(MergeJoin {
            file_a: AsyncReader::new(File::open(path_a)?, max_memory),
            file_b: AsyncReader::new(File::open(path_b)?, max_memory),
        })
    }
}

impl Join for MergeJoin {
    /// MERGE: Take from A until matching B, take from B until no longer matching in A.
    ///   File A and file B must both already by sorted. If unsorted, it'll probably
    ///   just not include data.
    fn run<W: Write>(mut self, mut out: JoinWriter<W>) {
        // let peek_a = self.file_a.peekable();
        let mut peek_b = self.file_b.peekable();

        while let Some(a) = self.file_a.next() {
            match a {
                Ok(a) => {
                    while let Some(b) = peek_b.next_if(|b| match b {
                        Ok(b) => a.key() == b.key(),
                        Err(err) => {
                            eprintln!("Error peeking file_b: {err:?}");
                            false
                        }
                    }) {
                        match b {
                            Ok(b) => match out.write(Record::joined(&a, &b)) {
                                Err(err) => {
                                    eprintln!("Error writing output for {}: {err:?}", a.key())
                                }
                                _ => (),
                            },
                            Err(err) => eprintln!("Error reading file_b: {err:?}"),
                        };
                    }
                }
                Err(err) => eprintln!("Error reading file a: {err:?}"),
            }
        }

        match out.finish() {
            Err(err) => eprintln!("Finish err: {err:?}"),
            _ => (),
        }
    }
}
