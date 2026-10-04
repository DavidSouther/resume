use std::cmp::Ordering;
use std::fmt;
use std::io::{self, Read};
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::thread;

/// Whole rows read once from a source and shared by every record sliced
/// from them.
pub type Rows = Arc<String>;

/// A record holds one CSV row, split into the join key (the first field) and
/// the rest of the row (every field after the first, separators included).
///
/// Records are zero copy: each one is a range into its rows. The rows stay
/// alive while any of their records do.
#[derive(Clone)]
pub struct Record {
    rows: Rows,
    start: usize,
    split: usize,
    end: usize,
}

impl Record {
    fn new(rows: Rows, start: usize, end: usize) -> Self {
        let split = rows[start..end].find(',').map_or(end, |i| start + i);
        Self {
            rows,
            start,
            split,
            end,
        }
    }

    /// Build the output row for a matched pair: the key, the rest of A, then
    /// the rest of B. The key comes from A; the caller has already matched it
    /// against B. A row with no fields after its key adds none, while an empty
    /// field is kept so columns stay aligned.
    pub fn joined(a: &Record, b: &Record) -> Self {
        let mut line = String::with_capacity(a.size() + b.size() - b.key().len());
        line.push_str(a.key());
        for record in [a, b] {
            if record.has_rest() {
                line.push(',');
                line.push_str(record.rest());
            }
        }
        let end = line.len();
        Self::new(Arc::new(line), 0, end)
    }

    /// The whole row, without its record separator.
    pub fn line(&self) -> &str {
        &self.rows[self.start..self.end]
    }

    pub fn key(&self) -> &str {
        &self.rows[self.start..self.split]
    }

    /// Fields after the key, without the leading separator. Empty when the
    /// row has only a key.
    pub fn rest(&self) -> &str {
        self.rows.get(self.split + 1..self.end).unwrap_or("")
    }

    /// Whether the row has fields after the key. `1,` has one empty field;
    /// `1` has none.
    pub fn has_rest(&self) -> bool {
        self.split < self.end
    }

    /// Bytes counted against max memory: the row without its record separator.
    pub fn size(&self) -> usize {
        self.end - self.start
    }
}

impl fmt::Debug for Record {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Record")
            .field("key", &self.key())
            .field("rest", &self.rest())
            .finish()
    }
}

/// Iterates the records in shared rows, front to back.
pub struct Records {
    rows: Rows,
    cursor: usize,
}

impl Records {
    pub fn new(rows: Rows) -> Self {
        Self { rows, cursor: 0 }
    }

    /// Bytes not yet yielded, record separators included.
    pub fn remaining(&self) -> usize {
        self.rows.len().saturating_sub(self.cursor)
    }
}

impl Iterator for Records {
    type Item = Record;

    fn next(&mut self) -> Option<Record> {
        if self.cursor >= self.rows.len() {
            return None;
        }
        let start = self.cursor;
        let end = self.rows[start..]
            .find('\n')
            .map_or(self.rows.len(), |i| start + i);
        self.cursor = end + 1;
        Some(Record::new(Arc::clone(&self.rows), start, end))
    }
}

/// One batch of whole rows.
type Batch = Rows;

/// Async reader that pulls the next rows from a file in a background thread.
///
/// Rows arrive in batches of at most `max_memory / 2` bytes, record separators
/// included. While the caller drains one batch, the background thread fills
/// the next, so buffered rows stay within `max_memory`. A single row larger
/// than half the budget still arrives, alone in an oversize batch. Records the
/// caller keeps hold their batch in memory past that bound, so a key group
/// larger than the budget pins every batch it spans.
pub struct AsyncReader {
    max_memory: usize,
    batch: Option<Records>,
    incoming: Option<Receiver<io::Result<Batch>>>,
    /// A record read ahead to find where a key group ends, yielded next.
    lookahead: Option<io::Result<Record>>,
}

impl AsyncReader {
    pub fn new<R: Read + Send + 'static>(reader: R, max_memory: usize) -> Self {
        // A rendezvous channel keeps the filled batch with the producer until
        // the consumer asks for it, so at most two batches exist at once.
        let (tx, rx) = mpsc::sync_channel(0);
        thread::spawn(move || read(reader, max_memory / 2, tx));
        Self {
            max_memory,
            batch: None,
            incoming: Some(rx),
            lookahead: None,
        }
    }

    pub fn max_memory(&self) -> usize {
        self.max_memory
    }

    /// Bytes of the current batch not yet yielded.
    pub fn current_memory(&self) -> usize {
        self.batch.as_ref().map_or(0, Records::remaining)
    }

    /// Collect all records in sequence with the same matching key. A
    /// read error ends the group early, with the next call returning
    /// the group and the call after that resetting to a new group.
    pub fn next_group(&mut self) -> Option<io::Result<Vec<Record>>> {
        let first = match self.next()? {
            Ok(record) => record,
            Err(e) => return Some(Err(e)),
        };
        let mut group = vec![first];
        while self.peek_key() == Some(group[0].key()) {
            group.extend(self.lookahead.take().and_then(Result::ok));
        }
        Some(Ok(group))
    }

    /// Skip records whose key sorts before `key`, then return the group with
    /// exactly `key`. `None` when no record has `key`. A record with a greater
    /// key stays unread for the next call. Keys compare byte-wise, so the
    /// rows must be sorted.
    pub fn next_matching(&mut self, key: &str) -> Option<io::Result<Vec<Record>>> {
        loop {
            let ordering = match self.peek()? {
                Ok(record) => record.key().cmp(key),
                Err(_) => return self.next_group(),
            };
            match ordering {
                Ordering::Less => self.lookahead = None,
                Ordering::Equal => return self.next_group(),
                Ordering::Greater => return None,
            }
        }
    }

    fn peek(&mut self) -> Option<&io::Result<Record>> {
        if self.lookahead.is_none() {
            self.lookahead = self.read_next();
        }
        self.lookahead.as_ref()
    }

    /// The next record's key, or `None` at the end of the rows or an error.
    fn peek_key(&mut self) -> Option<&str> {
        self.peek()?.as_ref().ok().map(Record::key)
    }

    fn read_next(&mut self) -> Option<io::Result<Record>> {
        loop {
            if let Some(record) = self.batch.as_mut().and_then(Iterator::next) {
                return Some(Ok(record));
            }
            // Release the handle on the drained batch before
            // waiting, so only caller retained records hold it.
            self.batch = None;
            match self.incoming.as_ref()?.recv() {
                Ok(Ok(batch)) => {
                    self.batch = Some(Records::new(batch));
                }
                Ok(Err(e)) => {
                    self.incoming = None;
                    return Some(Err(e));
                }
                Err(_) => {
                    self.incoming = None;
                    return None;
                }
            }
        }
    }
}

/// Read the source straight into batches of up to `budget` bytes, each ending
/// on a record separator, and hand each to the consumer. Stops when the input
/// ends, a read fails, or the consumer is gone.
fn read<R: Read>(mut reader: R, budget: usize, tx: SyncSender<io::Result<Batch>>) {
    let budget = budget.max(1);
    // The partial row after the last separator in a batch. It never holds a
    // separator, and it starts the next batch.
    let mut carry = Vec::new();

    loop {
        let mut buf = Vec::with_capacity(budget.max(carry.len()));
        buf.append(&mut carry);
        let mut has_row = false;
        let mut eof = false;
        let mut error = None;

        // Fill to the budget, then keep reading until the batch holds at
        // least one whole row.
        while !has_row || buf.len() < budget {
            let want = budget.saturating_sub(buf.len()).max(1);
            let from = buf.len();
            match reader.by_ref().take(want as u64).read_to_end(&mut buf) {
                Ok(n) => {
                    has_row |= buf[from..].contains(&b'\n');
                    if n < want {
                        eof = true;
                        break;
                    }
                }
                Err(e) => {
                    error = Some(e);
                    break;
                }
            }
        }

        if !eof {
            let cut = buf.iter().rposition(|&b| b == b'\n').map_or(0, |i| i + 1);
            carry = buf.split_off(cut);
        }
        if send_rows(buf, &tx).is_err() {
            return;
        }
        if let Some(e) = error {
            let _ = tx.send(Err(e));
            return;
        }
        if eof {
            return;
        }
    }
}

/// Send the rows in `buf` as one batch. On invalid UTF-8, send the whole rows
/// before it and then the error. `Err` means the reader should stop.
fn send_rows(buf: Vec<u8>, tx: &SyncSender<io::Result<Batch>>) -> Result<(), ()> {
    if buf.is_empty() {
        return Ok(());
    }
    match String::from_utf8(buf) {
        Ok(rows) => tx.send(Ok(Arc::new(rows))).map_err(|_| ()),
        Err(e) => {
            let valid = e.utf8_error().valid_up_to();
            let mut bytes = e.into_bytes();
            let cut = bytes[..valid]
                .iter()
                .rposition(|&b| b == b'\n')
                .map_or(0, |i| i + 1);
            bytes.truncate(cut);
            let error = io::Error::new(
                io::ErrorKind::InvalidData,
                "stream did not contain valid UTF-8",
            );
            let _ = send_rows(bytes, tx);
            let _ = tx.send(Err(error));
            Err(())
        }
    }
}

impl Iterator for AsyncReader {
    type Item = io::Result<Record>;

    fn next(&mut self) -> Option<Self::Item> {
        self.lookahead.take().or_else(|| self.read_next())
    }
}

/// Loads an entire file once and hands out any number of passes over its
/// rows. Every pass shares the one loaded copy.
pub struct SmallReader {
    rows: Rows,
}

impl SmallReader {
    pub fn new<R: Read>(mut reader: R) -> io::Result<Self> {
        let mut rows = String::new();
        reader.read_to_string(&mut rows)?;
        Ok(Self {
            rows: Arc::new(rows),
        })
    }

    /// A fresh pass over every row, front to back.
    pub fn records(&self) -> Records {
        Records::new(Arc::clone(&self.rows))
    }

    /// Bytes loaded, record separators included.
    pub fn size(&self) -> usize {
        self.rows.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn record(line: &str) -> Record {
        Record::new(Arc::new(line.to_string()), 0, line.len())
    }

    #[test]
    fn record_splits_key_from_rest() {
        let r = record("1,a,b");
        assert_eq!(r.key(), "1");
        assert_eq!(r.rest(), "a,b");
        assert_eq!(r.size(), 5);

        let r = record("1");
        assert_eq!(r.key(), "1");
        assert_eq!(r.rest(), "");

        let r = record("1,");
        assert_eq!(r.key(), "1");
        assert_eq!(r.rest(), "");
    }

    #[test]
    fn records_share_their_rows() {
        let rows = Arc::new("1,a\n2,b\n".to_string());
        let mut records = Records::new(Arc::clone(&rows));
        let first = records.next().unwrap();
        let second = records.next().unwrap();
        assert!(records.next().is_none());
        assert!(Arc::ptr_eq(&first.rows, &rows));
        assert!(Arc::ptr_eq(&second.rows, &rows));
        assert_eq!(first.key().as_ptr(), rows.as_ptr());
        assert_eq!(second.key().as_ptr(), rows[4..].as_ptr());
    }

    fn collect(input: &'static str, max_memory: usize) -> Vec<(String, String)> {
        AsyncReader::new(Cursor::new(input), max_memory)
            .map(|r| {
                let r = r.unwrap();
                (r.key().to_string(), r.rest().to_string())
            })
            .collect()
    }

    fn pairs(rows: &[(&str, &str)]) -> Vec<(String, String)> {
        rows.iter()
            .map(|(k, r)| (k.to_string(), r.to_string()))
            .collect()
    }

    #[test]
    fn yields_every_row_in_order() {
        let expected = pairs(&[("1", "a,b"), ("2", "c,d"), ("3", "e,f")]);
        assert_eq!(collect("1,a,b\n2,c,d\n3,e,f\n", 1024), expected);
        assert_eq!(collect("1,a,b\n2,c,d\n3,e,f", 1024), expected);
        // A budget smaller than any row still yields every row.
        assert_eq!(collect("1,a,b\n2,c,d\n3,e,f\n", 2), expected);
        assert_eq!(collect("1,a,b\n2,c,d\n3,e,f\n", 9), expected);
    }

    #[test]
    fn async_empty_input_yields_nothing() {
        assert!(collect("", 1024).is_empty());
    }

    #[test]
    fn buffered_rows_stay_within_half_the_budget() {
        let input: String = (0..1000).map(|i| format!("{i:03},x\n")).collect();
        let input: &'static str = Box::leak(input.into_boxed_str());
        let mut reader = AsyncReader::new(Cursor::new(input), 40);
        let mut count = 0;
        let mut peak = 0;
        while let Some(record) = reader.next() {
            record.unwrap();
            count += 1;
            // Measured after the yield, so add back the yielded row and its separator.
            peak = peak.max(reader.current_memory() + 6);
        }
        assert_eq!(count, 1000);
        assert!(peak <= 20, "peak {peak} exceeded half of max memory");
        assert!(peak > 6, "rows should arrive in batches, peak {peak}");
    }

    #[test]
    fn invalid_utf8_yields_rows_before_it_then_an_error() {
        let input: &'static [u8] = b"1,a\n\xff,b\n3,c\n";
        let mut reader = AsyncReader::new(Cursor::new(input), 1024);
        assert_eq!(reader.next().unwrap().unwrap().key(), "1");
        let err = reader.next().unwrap().unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
        assert!(reader.next().is_none());
    }

    fn group_keys(group: Option<io::Result<Vec<Record>>>) -> Option<Vec<String>> {
        group.map(|g| g.unwrap().iter().map(|r| r.line().to_string()).collect())
    }

    #[test]
    fn next_group_collects_one_key_across_batches() {
        let mut reader = AsyncReader::new(Cursor::new("1,a\n1,b\n2,c\n"), 1);
        assert_eq!(group_keys(reader.next_group()).unwrap(), ["1,a", "1,b"]);
        assert_eq!(group_keys(reader.next_group()).unwrap(), ["2,c"]);
        assert!(reader.next_group().is_none());
    }

    #[test]
    fn next_after_next_group_loses_no_record() {
        let mut reader = AsyncReader::new(Cursor::new("1,a\n2,b\n3,c\n"), 1024);
        reader.next_group().unwrap().unwrap();
        assert_eq!(reader.next().unwrap().unwrap().key(), "2");
        assert_eq!(group_keys(reader.next_group()).unwrap(), ["3,c"]);
    }

    #[test]
    fn next_matching_skips_smaller_keys() {
        let mut reader = AsyncReader::new(Cursor::new("1,a\n2,b\n4,c\n4,d\n6,e\n"), 1024);
        assert_eq!(
            group_keys(reader.next_matching("4")).unwrap(),
            ["4,c", "4,d"]
        );
        assert_eq!(group_keys(reader.next_matching("6")).unwrap(), ["6,e"]);
        assert!(reader.next_matching("7").is_none());
    }

    #[test]
    fn next_matching_keeps_a_greater_key_for_later() {
        let mut reader = AsyncReader::new(Cursor::new("1,a\n10,b\n"), 1024);
        assert!(reader.next_matching("0").is_none());
        assert!(reader.next_matching("01").is_none());
        assert_eq!(group_keys(reader.next_matching("10")).unwrap(), ["10,b"]);
    }

    #[test]
    fn a_read_error_ends_the_group_then_follows_it() {
        let input: &'static [u8] = b"1,a\n1,b\n\xff\n";
        let mut reader = AsyncReader::new(Cursor::new(input), 1024);
        assert_eq!(group_keys(reader.next_group()).unwrap(), ["1,a", "1,b"]);
        assert!(reader.next_group().unwrap().is_err());
        assert!(reader.next_group().is_none());

        let mut reader = AsyncReader::new(Cursor::new(input), 1024);
        assert!(reader.next_matching("2").unwrap().is_err());
        assert!(reader.next_matching("2").is_none());
    }

    fn keys(reader: &SmallReader) -> Vec<String> {
        reader.records().map(|r| r.key().to_string()).collect()
    }

    #[test]
    fn every_pass_yields_every_row() {
        let reader = SmallReader::new(Cursor::new("1,a\n2,b\n3,c")).unwrap();
        assert_eq!(keys(&reader), ["1", "2", "3"]);
        assert_eq!(keys(&reader), ["1", "2", "3"]);
        assert_eq!(reader.size(), 11);
    }

    #[test]
    fn passes_share_one_copy() {
        let reader = SmallReader::new(Cursor::new("1,a\n2,b\n")).unwrap();
        let a = reader.records().nth(1).unwrap();
        let b = reader.records().nth(1).unwrap();
        assert_eq!(a.key().as_ptr(), b.key().as_ptr());
    }

    #[test]
    fn small_empty_input_yields_nothing() {
        let reader = SmallReader::new(Cursor::new("")).unwrap();
        assert_eq!(reader.records().count(), 0);
    }

    #[test]
    fn invalid_utf8_is_an_error() {
        let err = SmallReader::new(Cursor::new(b"1,a\n\xff\n")).err().unwrap();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
    }
}
