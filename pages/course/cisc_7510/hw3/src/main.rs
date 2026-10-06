//! Assignment:
//! Write a command line program to "join" .csv files. Use any programming language
//! you're comfortable with (Python suggested). Your program should work similarly
//! to the unix "join" utility (google for it). Unlike the unix join, your program
//! will not require files to be sorted on the key. Your program must also accept
//! the "type" of join to use---merge join, inner loop join, or hash join, etc.
//! Assume that first column is the join key---or you can accept the column number
//! as paramater (like unix join command).
//!
//! Assumptions:
//! - simple CSV, without quoted fields or escaped field and record separators.
//! - first field in a record is the merge key.
//! - final output is merge key, remaining file a fields, remaining file b fields
//! - --max-memory states, in kb, the maximum size of loaded rows at a time. Row
//!   size is calculated at read time as the number of u8 bytes in the record,
//!   not counting the record separator. Field separators do count towards the
//!   max memory. In LOOP, File B is always fully loaded and --max-memory only
//!   applies to File A. Otherwise, max memory is split evenly between the files.
//!   Does _not_ count the size of the join key index and tracking details in HASH.
//! - --join-type LOOP|HASH|MERGE to specify which joiner to use.
//!   LOOP: File B is always the inner loop.
//!   MERGE: Take from A until matching B, take from B until no longer matching in A.
//!   File A and file B must both already by sorted. If unsorted, it'll probably
//!   just not include data.
//!   HASH: Create map of hash(B_key) => [(key, [B_rows])]. Iterate A, emitting A x B_rows for Hash(a_key).
//!   MERGE_SORT: Multi-pass index builder. (unimplemented, unrequested)
//!   - Pass 1: build a key index with all pairs of lines that have a matching key
//!   - Pass 2: build two sorters with what to write from file a, and what from file b
//!   - Pass 3: write file a in sort order to output file a'
//!   - Pass 4: write file b in sort order to output file b'
//!   - Pass 5: write joined file in sort order
//!  

use std::{fs::File, path::PathBuf};

use clap::{Parser, ValueEnum};

use csv_join::{
    disk::writer::JoinWriter, hash::HashJoin, join::Join, r#loop::LoopJoin, merge::MergeJoin,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
enum Mode {
    Loop,
    Merge,
    Hash,
}

/// Join two CSV files on their first field.
#[derive(Debug, Parser)]
#[command(version)]
struct Args {
    /// Maximum memory for loaded rows, in kb.
    #[arg(long, default_value_t = 1024)]
    max_memory: usize,
    /// Join algorithm to use.
    #[arg(long, value_enum, ignore_case = true)]
    join_type: Mode,
    /// Output file.
    #[arg(long, default_value = "out.csv")]
    out: PathBuf,
    /// First CSV file (A).
    path_a: PathBuf,
    /// Second CSV file (B).
    path_b: PathBuf,
}

impl Args {
    fn max_memory_bytes(&self) -> usize {
        self.max_memory * 1024
    }
}

fn main() {
    let args = Args::parse();
    let max_memory = args.max_memory_bytes();
    let out = JoinWriter::new(File::create(args.out).expect("File::create out"));
    match args.join_type {
        Mode::Loop => {
            let joiner =
                LoopJoin::create(args.path_a, args.path_b, max_memory).expect("LoopJoin create");
            joiner.run(out);
        }
        Mode::Merge => {
            let joiner =
                MergeJoin::create(args.path_a, args.path_b, max_memory).expect("MergeJoin create");
            joiner.run(out);
        }
        Mode::Hash => {
            let joiner =
                HashJoin::create(args.path_a, args.path_b, max_memory).expect("HashJoin create");
            joiner.run(out);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    #[test]
    fn args_definition_is_valid() {
        Args::command().debug_assert();
    }

    #[test]
    fn parses_documented_flags() {
        let args = Args::try_parse_from([
            "csv_join",
            "--max-memory",
            "64",
            "--join-type",
            "HASH",
            "./a.csv",
            "./b.csv",
        ])
        .unwrap();
        assert_eq!(args.max_memory_bytes(), 64 * 1024);
        assert_eq!(args.join_type, Mode::Hash);
        assert_eq!(args.path_a, PathBuf::from("./a.csv"));
        assert_eq!(args.path_b, PathBuf::from("./b.csv"));
    }

    #[test]
    fn join_type_is_case_insensitive_and_required() {
        let args = Args::try_parse_from(["csv_join", "--join-type", "loop", "a", "b"]).unwrap();
        assert_eq!(args.join_type, Mode::Loop);
        assert_eq!(args.max_memory, 1024);
        assert!(Args::try_parse_from(["csv_join", "a", "b"]).is_err());
    }
}
