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
//! - --join-type LOOP|HASH|MERGE to specify which joiner to use.
//!   LOOP: File B is always the inner loop.
//!   MERGE: Take from A until matching B, take from B until no longer matching in A.
//!   File A and file B must both already by sorted. If unsorted, it'll probably
//!   just not include data.
//!   HASH: Create map of hash(B_key) => [(key, [B_rows])]. Iterate A, emitting A x B_rows for Hash(a_key).
//!   file_b is the builder file, and should be the smaller file. No checks are made to keep it in memory.
//!   SORT_MERGE: Sort A and B, then MERGE them. Output is in key order. A file
//!   within half of --max-memory sorts in memory; a larger one sorts into a
//!   temp copy through a B+ tree key index.
//! - --max-memory states, in kb, the maximum size of loaded rows at a time. Row
//!   size is calculated at read time as the number of u8 bytes in the record,
//!   not counting the record separator. Field separators do count towards the
//!   max memory. In LOOP, File B is always fully loaded and --max-memory only
//!   applies to File A. Otherwise, max memory is split evenly between the files.
//!   Does _not_ count the size of the join key index and tracking details in HASH.
//! - --max-hash-memory states, in kb, the in-memory page budget for each of
//!   SORT-MERGE's key indexes, beyond which index pages spill to a temp file.
//!   Only resident index pages count; the index's own bookkeeping does not.
//!  
//! max-memory and max-hash-memory should almost certainly not be the machine's
//! maximum memory, but rather chosen to allow some overhead for program and OS
//! memory.

use std::{env, fs, fs::File, path::PathBuf, process};

use clap::{Parser, ValueEnum};

use csv_join::{
    disk::writer::JoinWriter, hash::HashJoin, join::Join, r#loop::LoopJoin, merge::MergeJoin,
    sort::Sorter,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
enum Mode {
    Loop,
    Merge,
    Hash,
    SortMerge,
}

/// Join two CSV files on their first field.
#[derive(Debug, Parser)]
#[command(version)]
struct Args {
    /// Maximum memory for loaded rows, in kb.
    #[arg(long, default_value_t = 1024)]
    max_memory: usize,
    /// In-memory page budget for each SORT-MERGE key index, in kb.
    #[arg(long, default_value_t = 1024)]
    max_hash_memory: usize,
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

    fn max_hash_memory_bytes(&self) -> usize {
        self.max_hash_memory * 1024
    }
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let max_memory = args.max_memory_bytes();
    let index_memory = args.max_hash_memory_bytes();
    let out = JoinWriter::new(File::create(args.out)?);
    match args.join_type {
        Mode::Loop => LoopJoin::create(args.path_a, args.path_b, max_memory)?.run(out),
        Mode::Merge => MergeJoin::from_paths(args.path_a, args.path_b, max_memory)?.run(out),
        Mode::Hash => HashJoin::create(args.path_a, args.path_b, max_memory)?.run(out),
        Mode::SortMerge => {
            let dir = env::temp_dir().join(format!("csv_join_sort_{}", process::id()));
            let (name_a, name_b) = (
                args.path_a.display().to_string(),
                args.path_b.display().to_string(),
            );
            let sorted =
                Sorter::create(args.path_a, args.path_b, max_memory, index_memory).run(&dir);
            let result = sorted.map_err(Into::into).and_then(|(a, b)| {
                MergeJoin::from_readers((a, name_a), (b, name_b), max_memory).run(out)
            });
            let _ = fs::remove_dir_all(&dir);
            result
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
    fn parses_every_flag() {
        let args = Args::try_parse_from([
            "csv_join",
            "--max-memory",
            "64",
            "--max-hash-memory",
            "256",
            "--join-type",
            "HASH",
            "--out",
            "o.csv",
            "./a.csv",
            "./b.csv",
        ])
        .unwrap();
        assert_eq!(args.max_memory_bytes(), 64 * 1024);
        assert_eq!(args.max_hash_memory_bytes(), 256 * 1024);
        assert_eq!(args.join_type, Mode::Hash);
        assert_eq!(args.out, PathBuf::from("o.csv"));
        assert_eq!(args.path_a, PathBuf::from("./a.csv"));
        assert_eq!(args.path_b, PathBuf::from("./b.csv"));
    }

    #[test]
    fn join_type_is_required_and_case_insensitive_and_the_rest_default() {
        assert!(Args::try_parse_from(["csv_join", "a", "b"]).is_err());
        let args = Args::try_parse_from(["csv_join", "--join-type", "loop", "a", "b"]).unwrap();
        assert_eq!(args.join_type, Mode::Loop);
        assert_eq!(args.max_memory, 1024);
        assert_eq!(args.max_hash_memory, 1024);
        assert_eq!(args.out, PathBuf::from("out.csv"));
    }
}
