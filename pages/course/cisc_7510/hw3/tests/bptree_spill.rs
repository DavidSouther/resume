//! Feature test: the B+ tree keeps HASH's key index under a tiny memory
//! budget by spilling pages to disk, and still returns every value.

use std::path::Path;

use csv_join::bptree::BPlusTree;

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
    let mut tree = BPlusTree::create(&path, BUDGET).unwrap();

    // Visit keys in a scrambled order (7919 is prime, so coprime with KEYS),
    // inserting each key once per round, so duplicates are far apart.
    let total = KEYS * VALUES_PER_KEY;
    for i in 0..total {
        let round = i / KEYS;
        let k = (i % KEYS) * 7919 % KEYS;
        tree.insert(&key(k), k * VALUES_PER_KEY + round).unwrap();
    }

    for k in 0..KEYS {
        let expected: Vec<u64> = (0..VALUES_PER_KEY)
            .map(|r| k * VALUES_PER_KEY + r)
            .collect();
        assert_eq!(
            tree.get(&key(k))
                .collect::<std::io::Result<Vec<_>>>()
                .unwrap(),
            expected,
            "values for {}",
            key(k)
        );
    }
    assert!(tree.get("absent").next().is_none());

    assert!(tree.pages_written() > 0, "expected pages to spill to disk");
    assert!(
        tree.peak_resident_bytes() <= BUDGET,
        "resident pages peaked at {} bytes, over the {BUDGET} byte budget",
        tree.peak_resident_bytes()
    );

    drop(tree);
    assert!(!path.exists(), "spill file should be removed on drop");
}
