# Candidate C: Hybrid — the T-table with a lifetime ruler

The table body does not change. Every row, every cross-out, every frame line,
every heap arrow, and every return arrow is exactly what
[Stage 0](./00-baseline.md) already drew, which is exactly what
[Tracing Algorithms](/blog/interview_03_tracing) already taught. Nothing in the
body is rewritten to make room for Rust.

All of the Rust information is carried in a **lifetime ruler** drawn in the left
margin, outside the table. The ruler is one narrow vertical stroke per live
binding, growing downward one row at a time as the trace grows. The stroke
glyphs are borrowed from the book's lifetime graph — circle at allocation,
filled diamond at drop, D-brackets for a shared borrow, triangle brackets for a
mutable borrow — but they stay in the margin. The lifeline never becomes the
body of the diagram; it annotates a body the reader already knows how to draw.

None of this has been tested with learners.

## The ruler

The ruler sits to the left of the table, separated from it by a double bar
`||`. Each binding gets a two-character column, labelled at the top with the
binding's name. A row of the ruler lines up with the row of the table that the
same statement wrote.

| Glyph | Meaning |
|---|---|
| `o` | The binding is created here. This is the top of its stroke. |
| `\|` | The binding is live and has full access to its data. |
| `.` | The binding is a reference. A reference's stroke is dotted for its whole length. |
| `:` | The binding is live but may not be touched right now. |
| `*` | The stroke ends because the data left. Nothing is destroyed here. |
| `#` | The stroke ends because the data is destroyed here. |
| `D` `C` | A shared borrow of this binding opens (`D`) and closes (`C`). |
| `>` `<` | A mutable borrow of this binding opens (`>`) and closes (`<`). |
| `?` | A binding was named here, and there is no stroke above the `?`. |

Nine glyphs, all of them writable with one pen stroke or two.

## The six marks

**Move.** The source column's stroke ends in a filled dot, `*`. A new column
opens with `o` on the same row, for the binding that received the data. The
table body still shows the same heap address in both rows, because a move does
not touch the data — it changes who will destroy it. The `*` is the mark that
says "this name is finished"; it is not a drop, and it is deliberately a
different glyph from one.

**Copy.** No `*` anywhere. The source column's stroke continues straight down
through the row while a new column opens with `o`. Two live strokes side by
side, from one statement, is the whole of copy. The table body shows two
different addresses, because a copy makes a second value.

**Borrow.** On the owner's column, `D` on the row of the `&` and `C` on the row
where the reference dies. Between them the owner's stroke stays `|`: the owner
may still be read during a shared borrow. The reference itself opens its own
column with `o` and runs dotted, `.`, to its own end.

**Mutable borrow.** On the owner's column, `>` opens and `<` closes. Between
them the owner's stroke is written `:` instead of `|`: the owner may not be
read or written for the span. The reference's column runs dotted, the same as
for a shared borrow — the difference between the two borrows is drawn on the
*owner*, which is where the difference actually is.

**Drop.** A filled diamond, `#`, on the row where the scope ends. Written when
the trace reaches the closing brace, never before.

**Lifetime.** Not a glyph. A lifetime is the vertical extent of a stroke, from
its `o` to its `#` or `*`. That is the point of a ruler: the thing the reader
must learn to see is a length, so it is drawn as a length, and it is measured
against the table rows beside it.

## Listing 2.2 — a plain lifetime

```rust
struct Artwork {
  name: String,
}

fn main() {
  let art1 = Artwork { name: "The Ordeal of Owain".to_string() };
  println!("{}", art1.name);
}
```

```text
art1 || main
  o  ||   art1 | 0x10 --------> [ Artwork { name: "The Ordeal of Owain" } ]
  |  ||   (println! reads art1.name)
  #  || end of main
```

The ruler for listing 2.2 is one stroke, one `o`, one `#`. The table half is
the Stage 0 trace unchanged. The ruler half says the lifetime of `art1` is the
whole of `main`.

## The Copy listing

No reference figure shows Copy, so this listing is added to the fixed set. It
is the one case where a second name does not cost the first one anything.

```rust
#[derive(Clone, Copy)]
struct Ticket {
  id: i32,
}

fn stamp(mut t: Ticket) -> Ticket {
  t.id += 1;
  t
}

fn main() {
  let t1 = Ticket { id: 7 };
  let t2 = t1;
  let t3 = stamp(t1);
  println!("{} {} {}", t1.id, t2.id, t3.id);
}
```

```text
t1 t2 t3 t  || main
 o          ||   t1 | { id: 7 }
 |  o       ||   t2 | { id: 7 }
 |  |     o || ─────────────────────────────── stamp
 |  |     | ||   t  | { id: ~~7~~ 8 }
 |  |  o  # || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX stamp returns; t dropped
 |  |  |    ||   t3 | { id: 8 }
 #  #  #    || end of main
```

Compare this against listing 2.5 below. The only difference in the ruler is
that `t1`'s stroke passes the call row as `|` rather than ending in `*`. That
one glyph is the entire move-versus-copy distinction, and a reader who has the
ruler can point at it.

## Listing 2.5 — use after move

```rust
struct Artwork {
  name: String,
}

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
art1 art || main
  o      ||   art1 | 0x10 ------> [ Artwork { name: "The Ordeal of Owain" } ]
  *   o  || ───────────────────────────────── admire_art
      |  ||   art  | 0x10 ------> [ Artwork { name: "The Ordeal of Owain" } ]
      #  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX admire_art returns; art dropped
  ?      ||   admire_art(art1);
```

The second call writes a `?` in `art1`'s column. There is no stroke above the
`?` — the column went blank three rows earlier, at the `*`. That blank gap is
the mark of use after move, and the reader draws it without knowing in advance
that the program is broken.

## Listing 2.9 — a shared borrow

```rust
fn admire_art(art: &Artwork) {
  println!("Wow, {} really makes you think.", art.name);
}

fn main() {
  let art1 = Artwork { name: "The Ordeal of Owain".to_string() };
  admire_art(&art1);
  admire_art(&art1);
}
```

```text
art1 art || main
  o      ||   art1 | 0x10 ------> [ Artwork { name: "The Ordeal of Owain" } ]
  D   o  || ───────────────────────────────── admire_art
  |   .  ||   art  | & 0x10 -----> art1
  C   #  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX art dropped; borrow closed
  D   o  || ───────────────────────────────── admire_art
  |   .  ||   art  | & 0x10 -----> art1
  C   #  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX art dropped; borrow closed
  #      || end of main
```

In listing 2.9, `art1`'s stroke is unbroken from `o` to `#`, so it is never
moved. Two borrow spans open and close inside that extent, and both close
before it ends. The
reference rows in the table are ordinary rows holding an address, drawn with
the same heap-arrow form the earlier post already uses.

## Listing 2.11 — a mutable borrow

```rust
fn admire_art(art: &mut Artwork) {
  println!("{} people have seen {} today!", art.view_count, art.name);
  art.view_count += 1;
}

fn main() {
  let mut art1 = Artwork { view_count: 0, name: "".to_string() };
  admire_art(&mut art1);
  admire_art(&mut art1);
}
```

```text
art1 art || main
  o      ||   art1 | 0x20 ------> [ Artwork { view_count: 0, name: "" } ]
  >   o  || ───────────────────────────────── admire_art
  :   .  ||   art  | &mut 0x20 --> art1
  :   .  ||   heap 0x20: view_count ~~0~~ -> 1
  <   #  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX art dropped; borrow closed
  |      ||   (zero references to art1 on this row)
  >   o  || ───────────────────────────────── admire_art
  :   .  ||   art  | &mut 0x20 --> art1
  :   .  ||   heap 0x20: view_count ~~1~~ -> 2
  <   #  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX art dropped; borrow closed
  #      || end of main
```

In listing 2.11 the two `:` runs never touch, and the row between them is
`|`. That is the
picture of "one mutable reference at a time": the rule is a statement about
rows, and the ruler makes it a statement about ink. The cross-out inside the
heap block is the same overwrite history Stage 0 draws for any mutation.

## Listing 2.12 — a reference outliving its referent

```rust
fn admire_art(art: Artwork) {
  println!("Wow, {} really makes you think.", art.name);
}

fn main() {
  let art1 = Artwork { name: "Man on Fire".to_string() };
  let borrowed_art = &art1;
  admire_art(art1);
  println!("I really enjoy {}", borrowed_art.name);
}
```

```text
art1 b_a art || main
  o          ||   art1 | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
  D    o     ||   borrowed_art | & 0x30 --> art1
  |    .     ||
  *    .   o || ──────────────────────────── admire_art
       .   | ||   art | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
       .   # || XXXXXXXXXXXXXXXXXXXXXXXXXXXX art dropped; the data is gone
       .     ||   println!("{}", borrowed_art.name)
```

The `D` on `art1` never gets its `C`. The dotted stroke for `borrowed_art` runs
past the `*` that ended `art1`, and past the `#` that destroyed the data, and
is still dotted on the row that reads it. A reference outliving its referent is
drawn as a dotted stroke with nothing beside it.

## Listing 2.13 — returning a reference to a dropped value

```rust
fn build_art() -> &Artwork {
  let art = Artwork { name: "La Liberté guidant le peuple".to_string() };
  &art
}

fn main() {
  let art = build_art();
}
```

```text
art ret || main
        || ─────────────────────────────────── build_art
  o     ||   art    | 0x40 ------> [ Artwork { name: "La Liberté ..." } ]
  D  o  ||   return | & 0x40 -----> art
  |  .  ||
  #  .  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX build_art ends; art dropped
     .  ||   art | & 0x40 -----> ???
```

The return arrow carries a dotted stroke out of a frame whose `#` has already
been written. Listing 2.12 and listing 2.13 leave the same picture behind — a
dotted stroke below a `#` — which is why they are one lesson and not two.

## The three errors, as one mark

All three canonical errors are a gap in the ruler, read on a single row:

1. **Use after move** (listing 2.5) — a `?` with no stroke above it.
2. **A reference outliving its referent** (listing 2.12) — a dotted stroke
   continuing below its referent's `#`.
3. **Returning a reference** out of a frame (listing 2.13) — the same dotted
   stroke below the same `#`, carried across a frame line.

The reader's question is always the same one: *is there ink above this row in
that column?* That is the sentence the whole notation exists to make askable.

## Draw order

The ruler is drawn top to bottom, one row per statement, by a reader who does
not know how the program ends. Here is listing 2.12 line by line. Each step
adds ink to exactly one new row; no earlier glyph is erased, moved, or
rewritten, and no glyph is reserved in advance.

**`let art1 = ...;`** — Write the table row the way Stage 0 already teaches it:
name, heap arrow, heap block. Then, in the margin beside that row, open a
column headed `art1` and write `o`. One column exists.

```text
art1 || main
  o  ||   art1 | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
```

**`let borrowed_art = &art1;`** — The `&` is visible in the source, so the
reader knows on this row that a borrow opens. Write `D` in `art1`'s column,
open a second column headed `b_a`, and write `o` in it. The `art1` stroke
continues as `|` on the rows below, because a shared borrow leaves the owner
readable. No decision here depends on anything later in the program.

```text
art1 b_a || main
  o      ||   art1 | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
  D    o ||   borrowed_art | & 0x30 --> art1
```

**`admire_art(art1);`** — The parameter type is `Artwork`, not `&Artwork`, so
this call moves. Write `*` in `art1`'s column on the frame-line row and stop
drawing that column. Open a third column for the callee's `art` with `o`. The
`D` written two rows ago is not revisited. Nothing is erased.

```text
art1 b_a art || main
  o          ||   art1 | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
  D    o     ||   borrowed_art | & 0x30 --> art1
  |    .     ||
  *    .   o || ──────────────────────────── admire_art
```

**End of `admire_art`** — The frame's closing brace is reached, so the drop is
written now, on the row where it happens: `#` in `art`'s column, and the big X
across the finished frame. The diamond was never reserved on an earlier row and
never moved down to meet the brace.

**`println!("{}", borrowed_art.name);`** — Continue `b_a`'s dotted stroke onto
this row, as with any live binding. The error is now visible without any
back-editing: the dotted stroke has nothing beside it. The reader sees the
defect at the moment they draw it, not after reasoning about the whole program.

Three properties make this work, and they are the argument for this candidate:

- **The table never moves.** All new ink lands in the margin, which is blank
  paper, so adding Rust information cannot disturb a row that is already
  written. Candidate A must widen or subdivide a column that already has ink in
  it; this candidate does not.
- **Every glyph is decided by the current statement alone.** `o` comes from a
  `let`, `D` and `>` come from a visible `&` or `&mut`, `*` comes from a
  by-value parameter type, `#` comes from a closing brace, `?` comes from a
  name with no ink above it. None of them requires knowing where the value will
  be dropped. Candidate B's finished figures place a drop diamond at a point the
  artist already knew; here the diamond is a consequence of reaching a brace.
- **A new binding opens a new column to the right.** The column is blank above
  its `o`, so opening it costs nothing on any earlier row. Left-margin width is
  the one real cost: a trace with many simultaneous live bindings needs a wide
  margin. Two characters per binding, and bindings that end free their column
  for reuse, keeps this within a normal page margin for every listing in the
  fixed set. This is a layout cost, not a back-editing cost.

## Ink

Every mark survives one ink color. The ruler distinguishes its states by stroke
shape — solid, dotted, dashed, open, filled — and by glyph, never by hue. A
reader with one black pen draws the same diagram as a reader with six colors.
Color may reinforce a column, for instance one hue per binding as Rufflewind
does, but no meaning is carried by color alone, and nothing is lost on a
photocopy.
