//! The size of the child's stack: how much memory `clone` gives PID 1 to run on.

use std::fmt;

/// The smallest accepted stack. A1 in `clone.rs` claims the child's stack use stays below this,
/// with a margin of 64x over the depth measured in a debug build (`tests/stack.sh`).
pub const MIN: usize = 1 << 20;
/// Used unless `--stack-size` says otherwise.
pub const DEFAULT: usize = 8 << 20;
/// The largest accepted stack. The memory is reserved, not committed, but a limit keeps a
/// typo from asking for terabytes.
pub const MAX: usize = 1 << 30;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("stack size: {text:?} is not a size like 8M, 512K, or 1048576")]
    Invalid { text: String },
    #[error("stack size: {text} is outside {} to {}", Human(MIN), Human(MAX))]
    OutOfRange { text: String },
}

/// A stack size in bytes, between `MIN` and `MAX`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StackSize(usize);

impl StackSize {
    /// Bytes, or a number followed by `K`, `M`, or `G` (powers of 1024, either case).
    pub fn parse(text: &str) -> Result<StackSize, Error> {
        let invalid = || Error::Invalid { text: text.to_owned() };
        let out_of_range = || Error::OutOfRange { text: text.to_owned() };

        let digits = text.trim_end_matches(|c: char| c.is_ascii_alphabetic());
        if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
            return Err(invalid());
        }
        let shift = match &text[digits.len()..] {
            "" => 0,
            "K" | "k" => 10,
            "M" | "m" => 20,
            "G" | "g" => 30,
            _ => return Err(invalid()),
        };
        let bytes = digits
            .parse::<usize>()
            .ok()
            .and_then(|n| n.checked_mul(1 << shift))
            .ok_or_else(out_of_range)?;
        if (MIN..=MAX).contains(&bytes) {
            Ok(StackSize(bytes))
        } else {
            Err(out_of_range())
        }
    }

    pub fn bytes(self) -> usize {
        self.0
    }
}

impl Default for StackSize {
    fn default() -> StackSize {
        StackSize(DEFAULT)
    }
}

/// A byte count the way a person would write it: `1M`, `512K`.
struct Human(usize);

impl fmt::Display for Human {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.0 {
            n if n % (1 << 30) == 0 => write!(f, "{}G", n >> 30),
            n if n % (1 << 20) == 0 => write!(f, "{}M", n >> 20),
            n if n % (1 << 10) == 0 => write!(f, "{}K", n >> 10),
            n => write!(f, "{n}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::assert_matches;

    use super::*;

    #[test]
    fn sizes_are_bytes_or_a_number_with_a_binary_suffix() {
        assert_eq!(StackSize::parse("8M").unwrap().bytes(), 8 << 20);
        assert_eq!(StackSize::parse("1048576").unwrap().bytes(), MIN);
        assert_eq!(StackSize::parse("2048k").unwrap().bytes(), 2 << 20);
        assert_eq!(StackSize::parse("1G").unwrap().bytes(), MAX);
    }

    #[test]
    fn the_default_is_eight_mebibytes() {
        assert_eq!(StackSize::default().bytes(), 8 << 20);
    }

    #[test]
    fn sizes_below_the_floor_or_above_the_ceiling_are_out_of_range() {
        for text in ["0", "1", "512K", "1048575", "2G", "99999999999G"] {
            assert_matches!(StackSize::parse(text), Err(Error::OutOfRange { .. }), "{text:?}");
        }
    }

    #[test]
    fn text_that_is_not_a_size_is_invalid() {
        for text in ["", "M", "abc", "8X", "-8M", "+8M", " 8M", "8M ", "8 M", "1.5M", "8MB"] {
            assert_matches!(StackSize::parse(text), Err(Error::Invalid { .. }), "{text:?}");
        }
    }

    #[test]
    fn the_range_error_names_the_range_in_human_units() {
        let err = StackSize::parse("64K").unwrap_err();

        assert_eq!(err.to_string(), "stack size: 64K is outside 1M to 1G");
    }
}
