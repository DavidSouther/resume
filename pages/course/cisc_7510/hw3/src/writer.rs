use std::io::{self, BufWriter, Write};

use crate::readers::Record;

/// Buffered output for joined rows.
///
/// Each record is copied into the buffer as soon as it arrives, then dropped,
/// so the writer never holds rows in memory past the buffer itself.
pub struct JoinWriter<W: Write> {
    out: BufWriter<W>,
}

impl<W: Write> JoinWriter<W> {
    pub fn new(out: W) -> Self {
        Self {
            out: BufWriter::new(out),
        }
    }

    /// Write one row, followed by a record separator.
    pub fn write(&mut self, record: Record) -> io::Result<()> {
        self.out.write_all(record.line().as_bytes())?;
        self.out.write_all(b"\n")
    }

    /// Flush every buffered row and return the underlying writer. Dropping a
    /// `JoinWriter` instead also flushes, but silently discards any error.
    pub fn finish(self) -> io::Result<W> {
        self.out.into_inner().map_err(|e| e.into_error())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::readers::SmallReader;
    use std::io::Cursor;

    fn rows(input: &'static str) -> Vec<Record> {
        SmallReader::new(Cursor::new(input))
            .unwrap()
            .records()
            .collect()
    }

    fn written(records: Vec<Record>) -> String {
        let mut writer = JoinWriter::new(Vec::new());
        for record in records {
            writer.write(record).unwrap();
        }
        String::from_utf8(writer.finish().unwrap()).unwrap()
    }

    fn joined(a: &'static str, b: &'static str) -> Vec<Record> {
        rows(a)
            .iter()
            .zip(rows(b).iter())
            .map(|(a, b)| Record::joined(a, b))
            .collect()
    }

    #[test]
    fn writes_each_row_on_its_own_line() {
        assert_eq!(written(rows("1,a\n2,b")), "1,a\n2,b\n");
    }

    #[test]
    fn joined_rows_are_key_then_rest_of_a_then_rest_of_b() {
        assert_eq!(
            written(joined("1,a,b\n2,c\n", "1,x\n2,y,z\n")),
            "1,a,b,x\n2,c,y,z\n"
        );
    }

    #[test]
    fn joined_rows_keep_empty_fields_and_skip_missing_ones() {
        assert_eq!(written(joined("1,\n2\n", "1,x\n2,\n")), "1,,x\n2,\n");
    }

    #[test]
    fn joined_rows_split_on_the_key() {
        let record = Record::joined(&rows("1,a")[0], &rows("1,x")[0]);
        assert_eq!(record.key(), "1");
        assert_eq!(record.rest(), "a,x");
        assert_eq!(record.size(), 5);
    }
}
