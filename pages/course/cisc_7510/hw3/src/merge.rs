use std::{fs::File, io::Write, path::PathBuf};

use crate::{
    disk::{
        readers::{AsyncReader, Record},
        writer::JoinWriter,
    },
    join::Join,
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
    /// MERGE: Taking each group from A, advance B to a matching group.
    /// Write their cross product with A outer and B inner.
    ///   File A and file B must both already be sorted byte-wise on the key.
    ///   If unsorted, it'll probably just not include data.
    fn run<W: Write>(mut self, mut out: JoinWriter<W>) {
        while let Some(a_group) = self.file_a.next_group() {
            let a_group = match a_group {
                Ok(group) => group,
                Err(err) => {
                    eprintln!("Error reading file_a: {err:?}");
                    break;
                }
            };
            let b_group = match self.file_b.next_matching(a_group[0].key()) {
                Some(Ok(group)) => group,
                Some(Err(err)) => {
                    eprintln!("Error reading file_b: {err:?}");
                    break;
                }
                None => continue,
            };
            for a in &a_group {
                for b in &b_group {
                    if let Err(err) = out.write(Record::joined(a, b)) {
                        eprintln!("Error writing output for {}: {err:?}", a.key());
                    }
                }
            }
        }

        if let Err(err) = out.finish() {
            eprintln!("Finish err: {err:?}");
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

    fn run(joiner: MergeJoin) -> String {
        let sink = Sink::default();
        joiner.run(JoinWriter::new(sink.clone()));
        String::from_utf8(sink.0.take()).unwrap()
    }

    fn join_bytes(a: &[u8], b: &[u8], max_memory: usize) -> String {
        run(MergeJoin {
            file_a: AsyncReader::new(Cursor::new(a.to_vec()), max_memory),
            file_b: AsyncReader::new(Cursor::new(b.to_vec()), max_memory),
        })
    }

    fn join(a: &str, b: &str) -> String {
        join_bytes(a.as_bytes(), b.as_bytes(), 1024)
    }

    // Every input below is sorted on the key, as MERGE requires.

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

    // Bifurcate the advance: whichever side has the smaller key moves past
    // it without writing.

    #[test]
    fn a_rows_behind_b_are_skipped() {
        assert_eq!(join("1,a\n2,b\n", "2,y\n"), "2,b,y\n");
    }

    #[test]
    fn b_rows_behind_a_are_skipped() {
        assert_eq!(join("2,b\n", "1,x\n2,y\n"), "2,b,y\n");
    }

    #[test]
    fn gaps_on_both_sides_still_join_every_match() {
        assert_eq!(
            join("1,a\n3,c\n5,e\n7,g\n", "0,w\n2,x\n3,y\n4,z\n5,v\n8,u\n"),
            "3,c,y\n5,e,v\n"
        );
    }

    #[test]
    fn disjoint_keys_write_nothing() {
        assert_eq!(join("1,a\n2,b\n", "3,x\n4,y\n"), "");
    }

    // Bifurcate the duplicates: repeats in B, in A, and in both give a cross
    // product with A outer and B inner.

    #[test]
    fn duplicate_b_keys_each_join_the_a_row() {
        assert_eq!(join("1,a\n", "1,x1\n1,x2\n"), "1,a,x1\n1,a,x2\n");
    }

    #[test]
    fn duplicate_a_keys_each_join_the_b_row() {
        assert_eq!(join("1,a1\n1,a2\n", "1,x\n"), "1,a1,x\n1,a2,x\n");
    }

    #[test]
    fn duplicate_keys_cross_with_a_outer_and_b_inner() {
        assert_eq!(
            join("1,a1\n1,a2\n", "1,x1\n1,x2\n"),
            "1,a1,x1\n1,a1,x2\n1,a2,x1\n1,a2,x2\n"
        );
    }

    #[test]
    fn duplicates_are_followed_by_later_matches() {
        assert_eq!(
            join("1,a1\n1,a2\n2,b\n", "1,x\n2,y\n"),
            "1,a1,x\n1,a2,x\n2,b,y\n"
        );
    }

    // Bifurcate the key comparison: equal keys join, any other key drops.

    #[test]
    fn a_key_does_not_match_its_prefix_or_extension() {
        assert_eq!(join("1,a\n10,b\n", "01,y\n10,x\n100,z\n"), "10,b,x\n");
    }

    #[test]
    fn whitespace_and_case_are_part_of_the_key() {
        assert_eq!(join(" k,b\nK,c\nk,a\n", "K,y\nk ,x\n"), "K,c,y\n");
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
        assert_eq!(join("1,a\n2,b", "1,x\n2,y"), "1,a,x\n2,b,y\n");
    }

    // Bifurcate the read: rows before a read error join on either side, and
    // the run still finishes.

    #[test]
    fn an_a_read_error_keeps_the_rows_before_it() {
        assert_eq!(
            join_bytes(b"1,a\n\xff,b\n3,c\n", b"1,x\n3,z\n", 1024),
            "1,a,x\n"
        );
    }

    #[test]
    fn a_b_read_error_keeps_the_rows_before_it() {
        assert_eq!(
            join_bytes(b"1,a\n3,c\n", b"1,x\n\xff,y\n3,z\n", 1024),
            "1,a,x\n"
        );
    }

    // Bifurcate the batching: one batch and one row per batch give the same
    // output.

    #[test]
    fn output_does_not_depend_on_the_memory_budget() {
        let a: String = (0..50).map(|i| format!("{i:02},a{i}\n")).collect();
        let b: String = (0..50)
            .step_by(7)
            .map(|i| format!("{i:02},b{i}\n"))
            .collect();
        let whole = join_bytes(a.as_bytes(), b.as_bytes(), 1 << 20);
        assert_eq!(whole.lines().count(), 8);
        assert_eq!(join_bytes(a.as_bytes(), b.as_bytes(), 1), whole);
        assert_eq!(join_bytes(a.as_bytes(), b.as_bytes(), 16), whole);
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

    fn run_broken(a: String, b: String) {
        let joiner = MergeJoin {
            file_a: AsyncReader::new(Cursor::new(a), 1024),
            file_b: AsyncReader::new(Cursor::new(b), 1024),
        };
        joiner.run(JoinWriter::new(Broken));
    }

    #[test]
    fn a_failing_finish_does_not_panic() {
        run_broken("1,a\n".to_string(), "1,x\n".to_string());
    }

    #[test]
    fn a_failing_write_does_not_panic() {
        // More output than the writer buffers, so the error comes from a write.
        run_broken("1,a\n".to_string(), "1,xxxxxxxxxxxxxxxx\n".repeat(1000));
    }

    // Every sorted fixture case, through the file constructor, at the case's
    // own byte budget. MERGE may order rows differently, so compare sorted
    // lines.

    fn sorted_on_key(file: &Path) -> bool {
        let rows = fs::read_to_string(file).unwrap();
        let keys: Vec<_> = rows.lines().map(|r| r.split(',').next().unwrap()).collect();
        keys.is_sorted()
    }

    fn sorted_lines(output: &str) -> Vec<&str> {
        let mut lines: Vec<_> = output.lines().collect();
        lines.sort();
        lines
    }

    #[test]
    fn joins_every_sorted_fixture_case_at_its_budget() {
        let data = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/data");
        let mut cases: Vec<_> = fs::read_dir(&data)
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|p| p.is_dir())
            .filter(|c| sorted_on_key(&c.join("a.csv")) && sorted_on_key(&c.join("b.csv")))
            .collect();
        cases.sort();
        assert!(
            cases.len() >= 3,
            "expected sorted fixture cases in {data:?}"
        );
        for case in cases {
            let max_memory = fs::read_to_string(case.join("max_memory"))
                .map_or(1 << 20, |s| s.trim().parse().unwrap());
            let joiner =
                MergeJoin::create(case.join("a.csv"), case.join("b.csv"), max_memory).unwrap();
            let expected = fs::read_to_string(case.join("expected.csv")).unwrap();
            assert_eq!(
                sorted_lines(&run(joiner)),
                sorted_lines(&expected),
                "case {case:?}"
            );
        }
    }
}
