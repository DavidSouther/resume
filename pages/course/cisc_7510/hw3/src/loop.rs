use std::eprintln;
use std::fs::File;
use std::io::{Error, Write};
use std::path::PathBuf;

use crate::join::Join;
use crate::readers::{AsyncReader, Record, SmallReader};
use crate::writer::JoinWriter;

pub struct LoopJoin {
    file_a: AsyncReader,
    file_b: SmallReader,
}

impl LoopJoin {
    pub fn try_new(path_a: PathBuf, path_b: PathBuf, max_memory: usize) -> Result<Self, Error> {
        Ok(LoopJoin {
            file_a: AsyncReader::new(File::open(path_a)?, max_memory),
            file_b: SmallReader::new(File::open(path_b)?)?,
        })
    }
}

impl Join for LoopJoin {
    pub fn run<W: Write>(mut self, mut out: JoinWriter<W>) {
        for record in &mut self.file_a {
            match record {
                Ok(a) => {
                    for b in self.file_b.records() {
                        if a.key() == b.key() {
                            if let Err(e) = out.write(Record::joined(&a, &b)) {
                                eprintln!("Write err: {e:?}")
                            }
                        }
                    }
                }
                Err(err) => eprintln!("Read err: {err:?}"),
            }
        }
        match out.finish() {
            Err(err) => eprintln!("Finish err: {err:?}"),
            _ => (),
        }
    }
}
