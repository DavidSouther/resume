# Candidate A: Extended T-table

Candidate A stays inside the table. The name column and the value column keep
the meaning they had in [Stage 0](/blog/interview_07_tracing_rust/candidates/00-baseline):
names on the left, values on the right, complex values drawn in the heap with
an arrow or a hex address, cross-out on overwrite. Nothing there changes.

One narrow column is added on the right of the value column. It is called the
**own** column, and it is the only new structure in this candidate. The 2021
Memory Diagram paper split the value column to add a stack address when stack
addresses were the concept being taught; Aquascope adds permission letters
beside each line for the same reason. The own column is the same move, made
for ownership.

The own column of a row is not a single symbol. It is a **strip** that grows
to the right as the trace grows downward. Each statement that changes what a
binding owns or may touch appends one more glyph to that binding's strip. A
glyph that stops being true is crossed out, the same way a value in the value
column is crossed out on overwrite. No glyph is ever erased, and no glyph ever
moves once it is written.

This material has not been tested with learners.

## Marks

Every glyph below is a pen stroke. There is no color in this candidate: the
whole notation survives one ink color, and that is a stated requirement, not
an accident.

| Concept | Glyph | Where it is written |
|---|---|---|
| Owns the data | `O` | The own strip of the owning binding's row, at the statement that created it |
| Move | `∅` appended to the source's strip, `O` on the new row | Source keeps its history; the receiving row opens with `O` |
| Copy | `O` on the new row, plus a `=` tie mark in the value column | Two owners, two addresses, equal bytes |
| Shared borrow | `&` on the reference's row, `*` appended to the owner's strip | `*` reads "frozen": the owner may read, not write, not move |
| Mutable borrow | `&m` on the reference's row, `#` appended to the owner's strip | `#` reads "locked": the owner may not touch the data at all |
| Borrow ends | The `*` or `#` is crossed out | Crossing out a freeze or a lock is the release |
| Drop | `†` appended to the strip, and the value is crossed out | Written when scope exit is reached, never before |
| Lifetime extent | The pair of statement stamps on the strip | `O@s1 … †@s6` reads as the extent; there is no drawn stroke |
| Error | `!` circled beside the offending row | See the errors section for the one tell that produces it |

Each glyph carries the statement number it was written at, as `O@s1`. The
statement stamp is what makes the lifetime extent readable. This is Candidate
A's weakest point and it is worth naming here: the extent is *recorded* as two
endpoints on a strip, not *drawn* as a length. A reader has to compare two
stamps instead of comparing two stroke lengths.

### The three verbs on one row

`let var_b = var_a;` writes a new row and appends to `var_a`'s strip:

- **Move** — new row `var_b | <same address> | O@sN`; append `∅@sN` to
  `var_a`. The address in the value column is the same on both rows, because
  the data did not move; only the owner did.
- **Copy** — new row `var_b | <new address> | O@sN`; append nothing to
  `var_a`. A `=` tie mark between the two value cells records that the bytes
  are equal and the two owners are independent.
- **Borrow** — new row `var_b | &<address> | &@sN`; append `*@sN` to `var_a`.
- **Mutable borrow** — new row `var_b | &mut <address> | &m@sN`; append
  `#@sN` to `var_a`.

## A Copy example

No reference figure in the source chapter shows Copy, so this candidate adds
one listing of its own. A `Copy` type is duplicated on assignment rather than
moved, and both bindings stay fully usable:

```rust
#[derive(Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}

fn main() {
    let p1 = Point { x: 3, y: 4 };
    let p2 = p1;
    println!("{} {}", p1.x, p2.x);
}
```

```text
main                              s1: let p1 = Point { x: 3, y: 4 };
  name | value          | own     s2: let p2 = p1;
  ------------------------------  s3: println!
  p1   | (3, 4) @0x10   | O@s1
  p2   | (3, 4) @0x20   | O@s2      = tie to p1: equal bytes, new address
  p1.x | 3              |           (watch row)
  p2.x | 3              |           (watch row)
  p1   | ~~(3, 4)~~     | O@s1 †@s4
  p2   | ~~(3, 4)~~     | O@s2 †@s4
```

The contrast with a move is the whole lesson, and it is one glyph wide: after
a copy, `p1`'s strip reads `O@s1`, unchanged. After a move it would read
`O@s1 ∅@s2`, and the `∅` is the mark that forbids the later use.

## Worked traces

The listings below are the six numbered programs from the source chapter,
whose lifetime-graph figures F2.1–F2.8 give a reference rendering of each. The
code for the earlier two is reconstructed from the chapter's prose, because
the excerpt prints the figure captions rather than the listings.

### Plain lifetime — listing 2.2

One binding, created and dropped inside `main`.

```text
main                              s1: let art1 = Artwork { .. };
  name | value            | own   s2: println!("{}", art1.name);
  -------------------------------  s3: end of main
  art1 | 0x10 --> [ .. ]  | O@s1
  art1.name | "The Ordeal of Owain"    (watch row)
  art1 | ~~0x10~~         | O@s1 †@s3
```

The strip reads `O@s1 †@s3`. That pair is the lifetime of `art1`, and it is
the smallest possible addition to a Stage 0 trace: one column, two glyphs.

### Use after move — listing 2.5

`admire_art` takes an owned `Artwork`, and `main` calls it twice.

```rust
fn admire_art(art: Artwork) {
    println!("Wow, {} really makes you think.", art.name);
}

fn main() {
    let art1 = Artwork { name: "The Ordeal of Owain".to_string() };
    admire_art(art1);
    admire_art(art1);
}
```

```text
main                              s1: let art1 = ..;
  name | value            | own   s2: admire_art(art1);
  ------------------------------  s3: admire_art(art1);
  art1 | 0x10 --> [ .. ]  | O@s1  ∅@s2
──────────────────────────────────────────── admire_art   (s2)
  art  | 0x10 --> [ .. ]  | O@s2  †@s2'
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out
main
  art1 | ~~0x10~~         | (!) use after move at s3
```

The tell is mechanical. At `s3` the reader looks up `art1`, reads its strip
left to right, and finds `∅@s2` before reaching the end. A binding whose strip
ends in `∅` has nothing to give. The `!` is circled beside the row, and the
program does not compile.

### Shared borrow — listing 2.9

`admire_art` now takes `&Artwork`, so `main` keeps the artwork and lends it
twice.

```text
main                              s1: let art1 = ..;
  name | value            | own   s2: admire_art(&art1);
  ------------------------------  s3: admire_art(&art1);
  art1 | 0x10 --> [ .. ]  | O@s1  ~~*@s2~~  ~~*@s3~~  †@s4
──────────────────────────────────────────── admire_art   (s2)
  art  | &0x10            | &@s2  †@s2'
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out
──────────────────────────────────────────── admire_art   (s3)
  art  | &0x10            | &@s3  †@s3'
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out
```

Two `*` glyphs are appended to `art1`'s strip and each is crossed out when its
frame is crossed out. Between the two calls `art1`'s strip has no live freeze,
which is why the program is legal. The owner's `†@s4` is appended last, at the
end of `main`, and it is appended after both `&` rows already carry their own
`†`. That ordering is the legality check, and the reader gets it for free by
reading the strips in the order they were written.

### Mutable borrow — listing 2.11

`admire_art` takes `&mut Artwork` and increments a view counter.

```text
main                              s1: let mut art1 = ..;
  name | value               | own   s2: admire_art(&mut art1);
  ---------------------------------  s3: admire_art(&mut art1);
  art1 | 0x10 --> [ vc: 0 ]  | O@s1  ~~#@s2~~  ~~#@s3~~  †@s4
──────────────────────────────────────────── admire_art   (s2)
  art  | &mut 0x10           | &m@s2  †@s2'
  heap 0x10: vc ~~0~~ 1
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out
──────────────────────────────────────────── admire_art   (s3)
  art  | &mut 0x10           | &m@s3  †@s3'
  heap 0x10: vc ~~1~~ 2
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out
```

`#` is stronger than `*`: while a `#` is live on a strip, the owner's row may
not be read at all, and a second `&m` row may not be opened. Both rules are
checked by looking at one strip for an uncrossed `#`. The mutation itself is
drawn in the heap with the ordinary cross-out, unchanged from Stage 0.

### Borrow invalidated by a move — listing 2.12

`borrowed_art` borrows `art1`, then `art1` is moved into `admire_art`, then
`borrowed_art` is used.

```text
main                              s1: let art1 = ..;
  name         | value      | own  s2: let borrowed_art = &art1;
  --------------------------------  s3: admire_art(art1);
  art1         | 0x10       | O@s1  *@s2  ∅@s3     s4: println!(borrowed_art.name)
  borrowed_art | &0x10      | &@s2
──────────────────────────────────────────── admire_art   (s3)
  art          | 0x10       | O@s3  †@s3'
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out
main
  borrowed_art | &0x10      | (!) reference outlives its referent
```

Read the two strips side by side at `s4`. `art1` carries `∅@s3`, and its data
carries `†@s3'` inside a frame that is already crossed out. `borrowed_art`
carries `&@s2` and no `†`. A live `&` below a dead referent is the error. Note
also that the `*@s2` freeze was never crossed out before the `∅@s3` was
appended — a move out from under a live freeze is the same error seen from the
other side.

### Returning a reference from a frame — listing 2.13

`build_art` creates an `Artwork` and tries to return a reference to it.

```text
main                              s1: let art = build_art();
  name | value       | own
  ------------------------------
──────────────────────────────────────────── build_art   (s1)
  art    | 0x30      | O@b1  †@b3       b1: let art = Artwork { .. };
  return | &0x30     | &@b2             b2: &art
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX frame crossed out at b3
main
  art  | &0x30       | (!) returning a reference to a dropped value
```

The tell is the same one, one frame higher. The `return` row holds a `&`
whose referent's strip already carries a `†` written in the frame that is
being crossed out. Any `&` crossing a frame line outward, toward a referent
that carries a `†` on the inside of that line, is this error.

The three errors reduce to a single sentence a reader can hold: **a `&` row
with no `†` must never sit below a `∅` or a `†` on the row it points at.**

## Draw order

The acceptance criterion is that the trace can be drawn top-to-bottom, one
statement at a time, by a reader who does not yet know how the program ends.
Below is listing 2.12 drawn statement by statement, with the state of the page
shown after each statement. Nothing already on the page is erased or moved at
any step; every step only appends.

**After `s1: let art1 = Artwork { .. };`**

```text
main
  name | value  | own
  ---------------------
  art1 | 0x10   | O@s1
```

One row, one glyph. The reader does not know whether `art1` will be moved,
borrowed, or dropped, and does not need to.

**After `s2: let borrowed_art = &art1;`**

```text
main
  name         | value  | own
  -----------------------------
  art1         | 0x10   | O@s1  *@s2
  borrowed_art | &0x10  | &@s2
```

Two marks appended: a new row, and one `*` at the right-hand end of `art1`'s
existing strip. The `O@s1` is untouched.

**After `s3: admire_art(art1);`**

```text
main
  name         | value  | own
  -----------------------------
  art1         | 0x10   | O@s1  *@s2  ∅@s3
  borrowed_art | &0x10  | &@s2
──────────────────────────────────── admire_art
  art          | 0x10   | O@s3  †@s3'
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

A frame line, a row inside it, and one more glyph on the end of `art1`'s
strip. The `†@s3'` on `art`'s strip is appended when the frame is crossed out
— at the moment scope exit is reached, never reserved in advance.

**After `s4: println!("I really enjoy {}", borrowed_art.name);`**

```text
main
  name         | value  | own
  -----------------------------
  art1         | 0x10   | O@s1  *@s2  ∅@s3
  borrowed_art | &0x10  | &@s2   (!)
──────────────────────────────────── admire_art
  art          | 0x10   | O@s3  †@s3'
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

One circled `!` appended to the end of `borrowed_art`'s strip. The error mark
appears on the page before the reader has read the compiler's message, which
is the whole point of the exercise.

### Why this order holds

Three properties of the own column make the no-back-editing rule hold, and all
three are worth stating plainly because Candidate B does not have them:

1. A strip only grows rightward. Appending is always legal, because the page
   reserved the whole row width when the row was drawn.
2. A glyph that stops being true is crossed out in place. Crossing out is the
   T-table's existing history mark, so it is not a new rule and it is not an
   erasure.
3. The drop `†` is appended at the statement where scope exit is reached. It
   is never reserved in advance, so the reader never needs foreknowledge of a
   drop point.

The cost is the one already named: the lifetime extent lives in two statement
stamps rather than in a drawn length, so "how long does this live" is a
comparison a reader performs rather than a shape a reader sees.

## Ink

Every mark in this candidate is a stroke: a letter, a slashed zero, an
asterisk, a hash, an ampersand, a dagger, a cross-out, or a circle. Every mark
survives one ink color. Color may reinforce a strip — one shade per binding,
as Rufflewind's figure does — but no mark in this candidate depends on color
to be read, so the whole notation works with a single color on a whiteboard or
a ballpoint on printed source.
