use std::collections::HashMap;
use std::eprintln;
use std::fs::File;
use std::io::{Error, Write};
use std::path::PathBuf;

use crate::disk::readers::{AsyncReader, Record};
use crate::disk::writer::JoinWriter;
use crate::join::Join;

pub struct HashJoin {
    map: HashMap<String, Vec<Record>>,
    file_a: AsyncReader,
    file_b: AsyncReader,
}

impl HashJoin {
    pub fn create(path_a: PathBuf, path_b: PathBuf, max_memory: usize) -> Result<Self, Error> {
        let max_memory = max_memory / 2;
        Ok(HashJoin {
            file_a: AsyncReader::new(File::open(path_a)?, max_memory),
            file_b: AsyncReader::new(File::open(path_b)?, max_memory),
            map: HashMap::new(),
        })
    }
}

impl Join for HashJoin {
    fn run<W: Write>(mut self, mut out: JoinWriter<W>) {
        for record in &mut self.file_b {
            match record {
                Ok(r) => {
                    self.map.entry(r.key().to_string()).or_default().push(r);
                }
                Err(err) => eprintln!("Read file_b err: {err:?}"),
            }
        }
        for record in self.file_a {
            match record {
                Ok(a) => {
                    if let Some(b) = self.map.get(a.key()) {
                        for b in b {
                            match out.write(Record::joined(&a, b)) {
                                Err(err) => eprintln!("Write err: {err:?}"),
                                _ => (),
                            }
                        }
                    }
                },
                Err(err) => eprintln!("Read file_a err: {err:?}"),
            }
        }
        if let Err(err) = out.finish() {
            eprintln!("Finish err: {err:?}")
        }
    }
}