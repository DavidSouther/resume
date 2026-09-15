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
`||`. Each binding gets a narrow column, labelled at the top with its name or
a stable call-qualified abbreviation such as `art#1`. A label never changes
or names a later binding. A row of the ruler lines up with the row of the
table that the same statement wrote.

| Glyph | Meaning |
|---|---|
| `o` | The binding is created here. This is the top of its stroke. |
| `\|` | An owning binding still has a value; borrow brackets determine its current access. |
| `.` | The binding is a reference. A reference's stroke is dotted for its whole length. |
| `:` | The binding is live but may not be touched right now. |
| `*` | The stroke ends because the data left. Nothing is destroyed here. |
| `#` | An owned value is destroyed here. |
| `R` | A reference binding reaches lexical scope end; its referent is untouched. |
| `D` `C` | A shared borrow of this binding opens (`D`) and closes (`C`). |
| `>` `<` | A mutable borrow of this binding opens (`>`) and closes (`<`). |
| `?` | The source requests an operation that the current ruler state does not permit. |

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
independent equal values; their machine addresses are not part of the rule.

**Borrow.** On the owner's column, `D` on the row of the `&` and `C` on the row
where the active loan ends. Between them the owner's stroke stays `|`: the
owner still has its value and may read it, though the shared loan prevents a
move, mutable borrow, or ordinary write. The reference itself opens its own
column with `o` and runs dotted, `.`, to `R` at lexical scope exit.

**Mutable borrow.** On the owner's column, `>` opens and `<` closes. Between
them the owner's stroke is written `:` instead of `|`: the owner may not be
read or written for the span. The reference's column runs dotted, the same as
for a shared borrow — the difference between the two borrows is drawn on the
*owner*, which is where the difference actually is.

**Drop.** A filled diamond, `#`, on the row where an owned value is destroyed.
Written when the trace reaches that point, never before. A reference instead
ends with `R`; ending a reference never destroys its referent.

**Lifetime.** Not a glyph. An owned value's extent runs from `o` to `#` or
`*`; an active loan runs from its opening bracket to `C` or `<`; and a
reference binding runs from `o` to `R`. These are distinct intervals:
non-lexical lifetime analysis can end a loan after its last use even while the
reference name remains in scope.

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
 |  |  o  # || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX stamp returns; t goes out of scope
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
art1 art#1 art#2 || main
  o              ||   art1 | 0x10 ------> [ Artwork { name: "The Ordeal of Owain" } ]
  D     o        || ───────────────────────────────── admire_art call 1
  |     .        ||   art  | & 0x10 -----> art1
  C     R        || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX loan and binding end
  D           o  || ───────────────────────────────── admire_art call 2
  |           .  ||   art  | & 0x10 -----> art1
  C           R  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX loan and binding end
  #              || end of main
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
art1 art#1 art#2 || main
  o              ||   art1 | 0x20 ------> [ Artwork { view_count: 0, name: "" } ]
  >     o        || ───────────────────────────────── admire_art call 1
  :     .        ||   art  | &mut 0x20 --> art1
  :     .        ||   heap 0x20: view_count ~~0~~ -> 1
  <     R        || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX loan and binding end
  |              ||   (zero references to art1 on this row)
  >           o  || ───────────────────────────────── admire_art call 2
  :           .  ||   art  | &mut 0x20 --> art1
  :           .  ||   heap 0x20: view_count ~~1~~ -> 2
  <           R  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX loan and binding end
  #              || end of main
```

In listing 2.11 the two `:` runs never touch, and the row between them is
`|`. That is the
picture of "one mutable reference at a time": the rule is a statement about
rows, and the ruler makes it a statement about ink. The cross-out inside the
heap block is the same overwrite history Stage 0 draws for any mutation.

## Listing 2.12 — a move rejected while borrowed

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
art1 b_a || main
  o      ||   art1 | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
  D    o ||   borrowed_art | & 0x30 --> art1
  |    . ||   admire_art(art1)   ? move rejected while D is open
  C    . ||   println!("{}", borrowed_art.name); last use closes loan
  #    R || end of main; bindings end and art1 is destroyed
```

The `D` on `art1` is still open at the attempted move because
`borrowed_art` is used on the following line. Mark the conflict, but do not
draw `*`, a callee binding, or destruction: compilation rejects the move, so
ownership never transfers. If it were allowed, the reference would outlive
its referent; Rust prevents that runtime state.

## Listing 2.13 — returning a reference to a dropped value

```rust
fn build_art<'a>() -> &'a Artwork {
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
  #  ?  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX rejected: ret cannot cross frame
```

The attempted return would carry a dotted stroke out of a frame whose owned
value ends at `#`. Mark that crossing as rejected. Do not draw a reference in
`main`: the compiler does not create a dangling reference.

## The three errors, as one rule

All three canonical errors are rejected operations, decided from the ruler
state on the current row:

1. **Use after move** (listing 2.5) — a `?` with no stroke above it.
2. **A reference outliving its referent** (the state prevented in listing
   2.12) — an attempted move while the reference's borrow bracket is open.
3. **Returning a reference** out of a frame (listing 2.13) — an attempted
   dotted stroke crossing the frame line where its referent reaches `#`.

The reader's question is always the same one: *does the current ruler state
permit this operation?* The answer may come from a missing owner stroke, an
open borrow bracket, or a frame boundary where the referent ends.

## Draw order

The ruler is drawn top to bottom, one row per statement, by a reader who does
not know how the program ends. Here is listing 2.12 line by line. Moves and
scope exits add ink to new rows without back-editing. Precise borrow ends are
called out separately because they require recognizing a later last use.

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
this call attempts a move. The open `D` says the shared borrow is still
active, so write `?` for the rejected operation. Do not write `*` or open a
callee column: the rejected program transfers nothing.

```text
art1 b_a || main
  o      ||   art1 | 0x30 ------> [ Artwork { name: "Man on Fire" } ]
  D    o ||   borrowed_art | & 0x30 --> art1
  |    . ||   admire_art(art1)   ? move rejected while D is open
```

**`println!("{}", borrowed_art.name);`** — Continue `b_a`'s dotted stroke onto
this row. This later use is why the borrow was active at the attempted move;
close the active loan with `C` after this use. Continue the dotted binding
stroke until lexical scope exit, where `R` ends it.

These properties make the ruler useful, but they do not prove a universal
no-back-editing claim:

- **The table never moves.** All new ink lands in the margin, which is blank
  paper, so adding Rust information cannot disturb a row that is already
  written. Candidate A must widen or subdivide a column that already has ink in
  it; this candidate does not.
- **Moves and lexical scope exits are decided by the current statement.** `o`
  comes from a `let`, `D` and `>` from visible borrows, `*` from an accepted
  by-value transfer, and `#` from destruction. Precise non-lexical borrow
  endings are the exception: recognizing a last use requires looking ahead or
  annotating the earlier row later.
- **A new binding opens a new column to the right.** The column is blank above
  its `o`, so opening it costs nothing on any earlier row. Labels remain fixed
  for the entire trace; columns are not reused under a different binding name.
  Left-margin width is therefore a real cost for traces with many bindings,
  though the fixed example set still fits a normal page margin. This is a
  layout cost, not a back-editing cost.

## Ink

Every mark survives one ink color. The ruler distinguishes its states by stroke
shape — solid, dotted, dashed, open, filled — and by glyph, never by hue. A
reader with one black pen draws the same diagram as a reader with six colors.
Color may reinforce a column, for instance one hue per binding as Rufflewind
does, but no meaning is carried by color alone, and nothing is lost on a
photocopy.
