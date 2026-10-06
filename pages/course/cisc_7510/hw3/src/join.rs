use std::io::Write;

use crate::disk::writer::JoinWriter;

/// A join algorithm over files A and B.
pub trait Join {
    /// Write one row per matching pair: the key, the rest of A, then the rest
    /// of B. Rows that are not valid UTF-8 are skipped and the join continues.
    /// A failed read or write stops the join. All skips are returned as a single 
    /// [`Skipped`](crate::disk::readers::Skipped) error, which also carries
    /// the error that stopped the run, if one did.
    fn run<W: Write>(self, out: JoinWriter<W>) -> anyhow::Result<()>;
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::disk::readers::Skipped;
    use crate::disk::readers::tests::Failing;
    use crate::hash::HashJoin;
    use crate::r#loop::LoopJoin;
    use crate::merge::MergeJoin;
    use std::cell::RefCell;
    use std::io::{self, Cursor, Read};
    use std::rc::Rc;

    /// A joiner over in-memory inputs named `a.csv` and `b.csv`.
    pub(crate) trait FromBytes: Join + Sized {
        fn from_bytes(a: impl Read + Send + 'static, b: &[u8], max_memory: usize) -> Self;
    }

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

    /// The run's result, and whatever reached the output before it ended.
    pub(crate) fn try_join<J: FromBytes>(
        a: &[u8],
        b: &[u8],
        max_memory: usize,
    ) -> (anyhow::Result<()>, String) {
        try_run(J::from_bytes(Cursor::new(a.to_vec()), b, max_memory))
    }

    fn try_run(joiner: impl Join) -> (anyhow::Result<()>, String) {
        let sink = Sink::default();
        let result = joiner.run(JoinWriter::new(sink.clone()));
        (result, String::from_utf8(sink.0.take()).unwrap())
    }

    /// Each row the run reported skipped.
    pub(crate) fn skipped_rows(result: anyhow::Result<()>) -> Vec<String> {
        let error = result.unwrap_err();
        let skipped = error.downcast_ref::<Skipped>().unwrap();
        skipped.rows.iter().map(|e| e.to_string()).collect()
    }

    struct Broken;

    impl Write for Broken {
        fn write(&mut self, _: &[u8]) -> io::Result<usize> {
            Err(io::Error::other("broken"))
        }

        fn flush(&mut self) -> io::Result<()> {
            Err(io::Error::other("broken"))
        }
    }

    macro_rules! each_joiner {
        ($check:ident) => {
            $check::<LoopJoin>();
            $check::<HashJoin>();
            $check::<MergeJoin>();
        };
    }

    // Bifurcate the run's errors: skips on either side are kept and reported
    // together, A's first, and each fatal error (read, write, finish) still
    // stops the run.

    fn bad_rows<J: FromBytes>() {
        let (result, output) = try_join::<J>(b"1,a\n\xff,b\n3,c\n", b"1,x\n3,\xff\n", 1024);
        let name = std::any::type_name::<J>();
        assert_eq!(output, "1,a,x\n", "{name}");
        assert_eq!(
            skipped_rows(result),
            ["a.csv:2:1: invalid UTF-8", "b.csv:2:3: invalid UTF-8"],
            "{name}"
        );
    }

    #[test]
    fn bad_rows_on_both_sides_are_skipped_and_reported_together() {
        each_joiner!(bad_rows);
    }

    fn read_error<J: FromBytes>() {
        let a = Failing(Cursor::new(b"\xff\n1,a\n"));
        let (result, output) = try_run(J::from_bytes(a, b"1,x\n", 1024));
        let name = std::any::type_name::<J>();
        assert_eq!(output, "1,a,x\n", "{name}");
        assert_eq!(
            result.unwrap_err().to_string(),
            "skipped 1 row\na.csv:1:1: invalid UTF-8\nstopped by: failed",
            "{name}"
        );
    }

    #[test]
    fn a_read_error_stops_the_run_and_keeps_the_skips_before_it() {
        each_joiner!(read_error);
    }

    fn finish_error<J: FromBytes>() {
        let joiner = J::from_bytes(Cursor::new(b"\xff\n1,a\n"), b"1,x\n", 1024);
        let error = joiner.run(JoinWriter::new(Broken)).unwrap_err();
        let skipped = error.downcast_ref::<Skipped>().unwrap();
        let name = std::any::type_name::<J>();
        assert_eq!(skipped.rows.len(), 1, "{name}");
        assert!(skipped.stopped_by.is_some(), "{name}");
    }

    #[test]
    fn a_failing_finish_stops_the_run_and_keeps_the_skips_before_it() {
        each_joiner!(finish_error);
    }

    fn write_error<J: FromBytes>() {
        // More output than the writer buffers, so the error comes from a write.
        let a = "1,aaaaaaaaaaaaaaaa\n".repeat(1000);
        let joiner = J::from_bytes(Cursor::new(a), b"1,x\n", 1024);
        let error = joiner.run(JoinWriter::new(Broken)).unwrap_err();
        assert!(
            error.downcast_ref::<io::Error>().is_some(),
            "{}: {error}",
            std::any::type_name::<J>()
        );
    }

    #[test]
    fn a_failing_write_stops_the_run() {
        each_joiner!(write_error);
    }
}
