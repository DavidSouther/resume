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
    pub fn create(path_a: PathBuf, path_b: PathBuf, max_memory: usize) -> Result<Self, Error> {
        Ok(LoopJoin {
            file_a: AsyncReader::new(File::open(path_a)?, max_memory),
            file_b: SmallReader::new(File::open(path_b)?)?,
        })
    }
}

impl Join for LoopJoin {
    fn run<W: Write>(mut self, mut out: JoinWriter<W>) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::fs;
    use std::io::{self, Cursor};
    use std::path::Path;
    use std::rc::Rc;

    /// Output that stays readable after `run` consumes the writer.
    #[derive(Clone, Default)]
    struct Sink(Rc<RefCell<Vec<u8>>>);

    impl Write for Sink {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.0.borrow_mut().write(buf)
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    fn run(joiner: LoopJoin) -> String {
        let sink = Sink::default();
        joiner.run(JoinWriter::new(sink.clone()));
        String::from_utf8(sink.0.take()).unwrap()
    }

    fn join_bytes(a: &[u8], b: &str, max_memory: usize) -> String {
        run(LoopJoin {
            file_a: AsyncReader::new(Cursor::new(a.to_vec()), max_memory),
            file_b: SmallReader::new(Cursor::new(b)).unwrap(),
        })
    }

    fn join(a: &str, b: &str) -> String {
        join_bytes(a.as_bytes(), b, 1024)
    }

    // Triangulate the output row: two matches with different keys and
    // widths, so no fixed row satisfies both.

    #[test]
    fn one_match_writes_key_then_rest_of_a_then_rest_of_b() {
        assert_eq!(join("1,a\n", "1,x\n"), "1,a,x\n");
    }

    #[test]
    fn another_match_writes_its_own_fields() {
        assert_eq!(join("2,b,c\n", "2,y\n"), "2,b,c,y\n");
    }

    // Triangulate the order: A drives the outer loop, B the inner one.

    #[test]
    fn output_follows_a_order_not_b_order() {
        assert_eq!(join("1,a\n2,b\n", "2,y\n1,x\n"), "1,a,x\n2,b,y\n");
    }

    #[test]
    fn duplicate_keys_cross_with_a_outer_and_b_inner() {
        assert_eq!(
            join("1,a1\n1,a2\n", "1,x1\n1,x2\n"),
            "1,a1,x1\n1,a1,x2\n1,a2,x1\n1,a2,x2\n"
        );
    }

    // Bifurcate the key comparison: equal keys join, any other key drops.

    #[test]
    fn matching_keys_join_and_unmatched_rows_drop() {
        assert_eq!(join("1,a\n2,b\n3,c\n", "3,z\n4,w\n1,x\n"), "1,a,x\n3,c,z\n");
    }

    #[test]
    fn disjoint_keys_write_nothing() {
        assert_eq!(join("1,a\n2,b\n", "3,x\n4,y\n"), "");
    }

    #[test]
    fn a_key_does_not_match_its_prefix_or_extension() {
        assert_eq!(join("1,a\n10,b\n", "10,x\n01,y\n100,z\n"), "10,b,x\n");
    }

    #[test]
    fn whitespace_and_case_are_part_of_the_key() {
        assert_eq!(join("k,a\n k,b\nK,c\n", "k ,x\nK,y\n"), "K,c,y\n");
    }

    // Bifurcate the rest of a row: missing fields add nothing, empty fields
    // keep their column.

    #[test]
    fn key_only_rows_add_no_fields() {
        assert_eq!(join("1\n2,a\n", "1,x\n2\n"), "1,x\n2,a\n");
    }

    #[test]
    fn empty_fields_keep_their_columns() {
        assert_eq!(join("1,\n2,a,\n", "1,\n2,,x\n"), "1,,\n2,a,,,x\n");
    }

    // Bifurcate the input sides: either one empty writes nothing.

    #[test]
    fn empty_a_writes_nothing() {
        assert_eq!(join("", "1,x\n"), "");
    }

    #[test]
    fn empty_b_writes_nothing() {
        assert_eq!(join("1,a\n", ""), "");
    }

    #[test]
    fn rows_without_a_trailing_separator_still_join() {
        assert_eq!(join("1,a\n2,b", "2,y\n1,x"), "1,a,x\n2,b,y\n");
    }

    // Bifurcate the read: rows before a read error join, the rest of A is
    // skipped, and the run still finishes.

    #[test]
    fn a_read_error_keeps_the_rows_before_it() {
        assert_eq!(
            join_bytes(b"1,a\n\xff,b\n3,c\n", "1,x\n3,z\n", 1024),
            "1,a,x\n"
        );
    }

    // Bifurcate the batching: one batch and one row per batch give the same
    // output.

    #[test]
    fn output_does_not_depend_on_the_memory_budget() {
        let a: String = (0..50).map(|i| format!("{i:02},a{i}\n")).collect();
        let b: String = (0..50).rev().step_by(7).map(|i| format!("{i:02},b{i}\n")).collect();
        let whole = join_bytes(a.as_bytes(), &b, 1 << 20);
        assert_eq!(whole.lines().count(), 8);
        assert_eq!(join_bytes(a.as_bytes(), &b, 1), whole);
        assert_eq!(join_bytes(a.as_bytes(), &b, 16), whole);
    }

    // Bifurcate the write: a failing output is reported, not a panic, both
    // while rows are written and when the writer finishes.

    struct Broken;

    impl Write for Broken {
        fn write(&mut self, _: &[u8]) -> io::Result<usize> {
            Err(io::Error::other("broken"))
        }

        fn flush(&mut self) -> io::Result<()> {
            Err(io::Error::other("broken"))
        }
    }

    fn run_broken(a: String) {
        let joiner = LoopJoin {
            file_a: AsyncReader::new(Cursor::new(a), 1024),
            file_b: SmallReader::new(Cursor::new("1,x\n")).unwrap(),
        };
        joiner.run(JoinWriter::new(Broken));
    }

    #[test]
    fn a_failing_finish_does_not_panic() {
        run_broken("1,a\n".to_string());
    }

    #[test]
    fn a_failing_write_does_not_panic() {
        // More output than the writer buffers, so the error comes from a write.
        run_broken("1,aaaaaaaaaaaaaaaa\n".repeat(1000));
    }

    // Every fixture case, through the file constructor, at the case's own
    // byte budget.

    #[test]
    fn joins_every_fixture_case_at_its_budget() {
        let data = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/data");
        let mut cases: Vec<_> = fs::read_dir(&data)
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|p| p.is_dir())
            .collect();
        cases.sort();
        assert!(cases.len() >= 14, "expected fixture cases in {data:?}");
        for case in cases {
            let max_memory = fs::read_to_string(case.join("max_memory"))
                .map_or(1 << 20, |s| s.trim().parse().unwrap());
            let joiner =
                LoopJoin::create(case.join("a.csv"), case.join("b.csv"), max_memory).unwrap();
            let expected = fs::read_to_string(case.join("expected.csv")).unwrap();
            assert_eq!(run(joiner), expected, "case {case:?}");
        }
    }
}
