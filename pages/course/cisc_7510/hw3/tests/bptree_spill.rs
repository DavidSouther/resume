//! Feature test: the B+ tree keeps HASH's key index under a tiny memory
//! budget by spilling pages to disk, and still returns every value.

use std::path::Path;

use csv_join::bptree::IndexBuilder;

const KEYS: u64 = 5_000;
const VALUES_PER_KEY: u64 = 4;
/// Four 4 KiB pages: far below the size of 20,000 entries.
const BUDGET: usize = 16 * 1024;

fn key(k: u64) -> String {
    format!("key{k:05}")
}

#[test]
fn spills_under_a_tiny_budget_and_returns_every_value() {
    let path = Path::new(env!("CARGO_TARGET_TMPDIR")).join("bptree_spill.pages");
    let mut builder = IndexBuilder::create(&path, BUDGET).unwrap();

    // Visit keys in a scrambled order (7919 is prime, so coprime with KEYS),
    // inserting each key once per round, so duplicates are far apart.
    let total = KEYS * VALUES_PER_KEY;
    for i in 0..total {
        let round = i / KEYS;
        let k = (i % KEYS) * 7919 % KEYS;
        builder.insert(&key(k), k * VALUES_PER_KEY + round).unwrap();
    }

    assert!(
        builder.pages_written() > 0,
        "expected pages to spill to disk"
    );
    assert!(
        builder.peak_resident_bytes() <= BUDGET,
        "resident pages peaked at {} bytes, over the {BUDGET} byte budget",
        builder.peak_resident_bytes()
    );
    let index = builder.finish().unwrap();

    for k in 0..KEYS {
        let expected: Vec<u64> = (0..VALUES_PER_KEY)
            .map(|r| k * VALUES_PER_KEY + r)
            .collect();
        assert_eq!(
            index
                .get(&key(k))
                .collect::<std::io::Result<Vec<_>>>()
                .unwrap(),
            expected,
            "values for {}",
            key(k)
        );
    }
    assert!(index.get("absent").next().is_none());

    drop(index);
    assert!(!path.exists(), "spill file should be removed on drop");
}
