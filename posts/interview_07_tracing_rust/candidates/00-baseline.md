# Stage 0: Baseline recreation

This stage adds zero Rust marks. Every form below is the same form used in
[Tracing Algorithms](/blog/interview_03_tracing), applied to a Rust listing
instead of a JavaScript or Java one. No new Rust-specific marks are
introduced here — Stage 0 exists only to show that the reader's existing
T-table already survives contact with Rust source, before anything about
ownership, move, copy, or borrowing is added to it.

## The listing

```rust
fn shout(word: String) -> String {
    let mut loud = word;
    loud.push('!');
    loud
}

fn main() {
    let phrase = String::from("hi");
    let result = shout(phrase);
    println!("{result}");
}
```

## Draw order

Start the T-table with names on the left, values on the right, exactly as
before.

```text
main
  phrase | 0x10 ------------------> [ h i ]        (heap)
```

`phrase` is a `String`, a complex value, so its value column holds an arrow
into the heap rather than the bytes themselves — the same heap-drawing form
the earlier post uses for objects and arrays. The heap block is labelled with
a pretend hex address, `0x10`, the same pseudo-random heap-pointer extension
from the earlier post's "Fewer Arrows with Heap Pointers" section.

`shout(phrase)` is a call into a function that is part of the program being
traced, so it gets a frame: a horizontal frame line across the table, the
function's name written to the left of the name column, and its parameter
added as a new row.

```text
main
  phrase | 0x10 ------------------> [ h i ]
────────────────────────────────────────────  shout
  word   | 0x10 ------------------> [ h i ]
```

Inside `shout`, `let mut loud = word;` writes a new row. Because this stage
draws Rust exactly the way the earlier post draws any language — no move
mark, no ownership column — `loud` is simply a new name bound to the same
value the earlier post would draw for any reassignment: the same heap arrow.

```text
────────────────────────────────────────────  shout
  word   | 0x10 ------------------> [ h i ]
  loud   | 0x10 ------------------> [ h i ]
```

`loud.push('!')` mutates the heap block in place. The old contents inside the
heap box are crossed out, not erased, and the new contents are written next
to the cross-out — the same crossed-out history the earlier post keeps for
every overwrite, so a reader can look back at the table and see exactly how
the value changed.

```text
  heap 0x10:  [ h i ]  ~~[ h i ]~~ -> [ h i ! ]
```

An expression watch row tracks `loud.len()` right before the return, the way
the earlier post's "Expression Evaluation as Variables" extension adds a
watch entry for any expression the tracer wants to keep an eye on without
writing it back into a real variable:

```text
  loud.len() | 3            (watch)
```

`shout` returns `loud`. A `return` row is added with the return value, and a
return arrow is drawn along the left margin of the stack back to the caller's
variable, `result` — the same return-arrow form the earlier post uses for
every function call that is part of the traced solution. The completed frame
is then crossed off with a big X, exactly as the earlier post crosses off a
finished call.

```text
────────────────────────────────────────────  shout
  word       | 0x10 ------------------> [ h i ! ]
  loud       | 0x10 ------------------> [ h i ! ]
  loud.len() | 3
  return     | 0x10 --.
XXXXXXXXXXXXXXXXXXXXXXX|XXXXXXXXXXXXXXXX  shout, crossed out
                        `-----------------> result
main
  phrase | 0x10 ------------------> [ h i ! ]
  result | 0x10 ------------------> [ h i ! ]
```

Finally, if `main` wrapped the `println!` in a block — say, an inner `{ }`
around a temporary formatted string — that block is drawn the same way the
earlier post draws any block scope: a dashed line opens the scope instead of
a solid one, the block's local names are added below it, and the dashed
block is crossed off at scope exit, the same as a function frame.

```text
main
  phrase | 0x10 ------------------> [ h i ! ]
  result | 0x10 ------------------> [ h i ! ]
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  (dashed block scope)
  line   | "hi!"
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  crossed off at scope exit
```

## What this stage proves

Every mark used above — the T-table itself, the cross-out on overwrite, the
heap drawing with its arrow and hex address, the function frame line, the
return row and its return arrow, the expression watch row, and the dashed
block scope — is a form the reader already owns from the earlier post. None
of it needed to change to draw Rust source. The next stage adds the smallest
possible mark on top of this unchanged baseline.
