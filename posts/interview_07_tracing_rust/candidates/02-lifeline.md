# Candidate B: Lifeline graph

Candidate B replaces the body of the T-table with one vertical **lifeline**
per binding. Time runs down the page, as it does in the T-table, but a
binding is no longer a row: it is a column. The notation is taken from the
book's lifetime graphs (figures 2.1 through 2.8) and from Rufflewind's
move/copy/borrow poster.

This is the most expressive of the three candidates on lifetime extent, and
it is the one that discards the reader's existing table. Nothing the reader
learned from [Tracing Algorithms](/blog/interview_03_tracing) is reused here
except the top-to-bottom time axis. None of this material has been tested
with learners.

## Marks

Six marks, all drawn with one pen.

| Concept | Mark | ASCII in the traces below |
|---|---|---|
| Allocation | circle around the binding name | `(art1)` |
| Live owned value | solid vertical lifeline | `\|` |
| Reference | dotted circle and dotted lifeline | `(:art:)` and `:` |
| Move | filled dot ends the source lifeline, arrow to a new circle | `*----.` |
| Copy | bifurcation; both lifelines continue | `+----.` |
| Shared borrow | D-bracket opens the span, mirrored D closes it | `-D-` … `-C-` |
| Mutable borrow | triangle bracket opens, mirrored triangle closes | `->-` … `-<-` |
| Referent under `&mut` | dashed lifeline for the span | `!` |
| Drop | filled diamond ends the lifeline | `<>` |
| Lifetime extent | the length of the lifeline between circle and diamond | the column itself |
| Frame | a bracket opened at the call, closed at the return | `+---` … `+---` |

Move and copy are told apart by the junction glyph alone: a filled dot ends
the source, a T-junction does not. Shared and mutable borrow are told apart
by the bracket shape, D against triangle, and by whether the referent's own
lifeline continues solid or turns dashed for the span.

The error tell is uniform across all three canonical errors: **a reference's
dotted lifeline extends past its referent's drop diamond**, or the lifeline
a program asks for is not on the page at all.

## Worked traces

The same seven programs every candidate is drawn against.

### listing 2.2 — a plain lifetime

```rust
fn main() {
    let art1 = Artwork { name: "Boy with Apple".to_string() };
}
```

```text
  main
  +--------------------------------
  |   (art1)
  |      |
  |      |
  |     <>     art1 is dropped just before main ends
  +--------------------------------
```

One circle, one stroke, one diamond. The distance between the circle and the
diamond is the lifetime of `art1`; nothing else on the page carries it.

### listing 2.5 — use after move

```rust
fn admire_art(art: Artwork) {
    println!("Wow, {} really makes you think.", art.name);
}

fn main() {
    let art1 = Artwork { name: "Boy with Apple".to_string() };
    admire_art(art1);
    admire_art(art1);
}
```

```text
  main
  +---------------------------------------------------
  |   (art1)
  |      |
  |      |             admire_art
  |      *-------.     +----------------------
  |               `--> |   (art)
  |                    |     |
  |                    |    <>
  |                    +----------------------
  |      .
  |      .   second admire_art(art1): nothing to move from
  +---------------------------------------------------
```

The filled dot ends `art1`'s lifeline in `main`. The second call asks for a
lifeline that is not there. This is **use after move**, and the mark that
says so is the absence of a stroke below the dot.

### listing 2.9 — a shared borrow

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
  main
  +---------------------------------------------------
  |   (art1)
  |      |
  |      |             admire_art
  |     -D- - - - ->   +----------------------
  |      |             |   (:art:)
  |      |             |      :
  |      |             |     <>
  |     -C-            +----------------------
  |      |
  |      |             admire_art
  |     -D- - - - ->   +----------------------
  |      |             |   (:art:)
  |      |             |      :
  |      |             |     <>
  |     -C-            +----------------------
  |      |
  |     <>
  +---------------------------------------------------
```

`art1`'s lifeline is solid the whole way down: a shared borrow does not move
anything. Each reference gets its own dotted circle, its own dotted lifeline,
and its own diamond inside the callee's frame. Both borrow spans close above
`art1`'s diamond, so the program compiles.

### listing 2.11 — a mutable borrow

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
  main
  +---------------------------------------------------
  |   (art1)
  |      |
  |     ->- - - - ->   +----------------------
  |      !             |   (:art:)   admire_art
  |      !             |      :
  |      !             |     <>
  |     -<-            +----------------------
  |      |
  |     ->- - - - ->   +----------------------
  |      !             |   (:art:)   admire_art
  |      !             |      :
  |      !             |     <>
  |     -<-            +----------------------
  |      |
  |     <>
  +---------------------------------------------------
```

The triangle brackets mark the mutable borrow span, and `art1`'s own lifeline
turns dashed inside it: the owner may not read or write for that stretch. The
two dashed stretches do not touch, so only one mutable borrow is ever live,
and the program compiles.

### listing 2.12 — a borrow invalidated by a move

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
  main
  +-------------------------------------------------------------
  |   (art1)
  |      |
  |     -D- - - ->  (:borrowed_art:)
  |      |                  :
  |      |                  :        admire_art
  |      *-------.          :        +--------------------
  |               `------------------>   (art)
  |                         :        |     |
  |                         :        |    <>   the data dies here
  |                         :        +--------------------
  |                         :
  |                         :   <-- still live, still dotted
  |                        <>
  +-------------------------------------------------------------
```

`borrowed_art`'s dotted lifeline runs below the diamond that ends its
referent. The reference is **outliving its referent**, and the drawing shows
it without any compiler message: a dotted line crosses a horizontal level
where the solid line it depends on has already stopped.

### listing 2.13 — a reference returned from a frame

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
  build_art
  +------------------------------
  |   (art)
  |      |
  |     -D- - - ->  (:&art:)
  |      |               :
  |     <>               :   art is dropped at the end of build_art
  +----------------------:-------
                         :   returned out of the frame
  main                   :
  +----------------------:-------
  |   (art) = build_art():
  |      :  <  <  <  <  <'
  |      :
  |     <>
  +------------------------------
```

Same tell, one frame higher: **returning a reference** carries its dotted
lifeline out of a frame whose owned lifeline already ended in a diamond. If a
function returns a reference and takes no reference as a parameter, the
dotted line always has to cross a diamond on the way out.

### listing Copy — the added seventh program

No reference figure draws **Copy**, so this listing is added to the set.

```rust
fn main() {
    let a: i32 = 7;
    let b = a;
    println!("{a} {b}");
}
```

```text
  main
  +---------------------------------
  |   (a)
  |    |
  |    +-----.     bifurcation, not a filled dot
  |    |      \
  |    |      (b)
  |    |       |
  |    |       |
  |   <>      <>
  +---------------------------------
```

The difference from a move is one glyph. A move ends the source with a filled
dot; a copy leaves a T-junction and both lifelines run on to their own
diamonds. Each binding owns its own bytes, so each gets its own drop.

## Draw order

The criterion is that a reader who does not know how the program ends can
draw the trace one statement at a time, adding marks only, with no
back-editing of anything already on the page.

Walk listing 2.12 line by line.

1. `fn main() {` — draw the frame's left edge and its top edge. The bottom
   edge is not drawn yet. An open bracket is additive; a closed rectangle is
   not.
2. `let art1 = ...;` — open a column. Write `(art1)` and start a solid stroke
   under it.
3. `let borrowed_art = &art1;` — draw `-D-` on `art1`'s stroke, open a second
   column to the right with `(:borrowed_art:)`, and start a dotted stroke.
   Both existing marks are untouched.
4. `admire_art(art1);` — put a filled dot on `art1`'s stroke and run an arrow
   to a new frame bracket on the right. Inside it, `(art)`, a stroke, and at
   the frame's close a diamond. Keep extending `borrowed_art`'s dotted stroke
   down past all of it, because that binding is still in scope.
5. `println!(... borrowed_art.name);` — the dotted stroke is already below the
   diamond. The error is visible at the moment it is drawn.
6. `}` — close `main`'s bracket and put the last diamond on `borrowed_art`.

Every mark in that walk was added, never erased, never moved, and no diamond
was reserved before its scope exit was reached. On drop points alone,
Candidate B satisfies **no back-editing**.

### Where this candidate needs foreknowledge

It needs foreknowledge in two places, and both are real.

**1. Horizontal budget.** The T-table grows downward, and paper is
effectively unbounded downward. A lifeline graph grows *sideways*: every new
binding claims a fresh column, and every call claims a frame bracket to the
right of its caller. To place the first column the reader must already know
how many bindings and how many nested frames the program will produce. Get it
wrong and there is no additive repair — the page runs out of width and the
whole drawing is restarted. Listing 2.12 above needs four columns, and the
reader cannot know that from its first line. This is a layout failure, not a
semantic one, but it is the failure a reader meets first, on the first
statement, every time.

**2. The end of a borrow span.** The mutable-borrow mark is a *span*: a
triangle bracket opens it, the referent's lifeline is dashed for its length,
and a mirrored triangle closes it. When the borrow is a call argument, as in
listing 2.11, the span closes at the return and no foreknowledge is needed.
When the borrow is bound to a name, as `let r = &mut x;`, the span ends at the
reference's last use, which is somewhere further down a page the reader has
not read. The reader has two choices, and neither is free:

- Dash conservatively to the end of the reference's lexical scope. Additive
  and drawable, but it over-reports the lock and will mark some programs that
  compile as if they do not.
- Wait, learn the last use, then go back and dash the correct stretch. Correct
  and back-editing — exactly the thing the criterion forbids.

The shared-borrow D-bracket has the same shape of problem, but it is milder,
because a shared borrow does not change how the referent's own lifeline is
drawn; only the closing `-C-` has to wait.

So the honest summary is: Candidate B keeps drop diamonds incremental, and
fails the draw-order criterion on page layout always, and on named borrow
spans whenever the borrow is not a call argument.

## Ink

Every mark above is a shape, a stroke style, or a junction: circle against
dotted circle, solid against dotted against dashed stroke, filled dot against
T-junction, D-bracket against triangle bracket, diamond at the end. None of
them depends on color. Rufflewind's poster uses a different color per
lifeline, and that helps, but it carries no meaning the shapes do not already
carry, so every mark here survives one ink color on white paper.
