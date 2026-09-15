---
title: "Tracing Rust: Ownership, Borrows, and Lifetimes on Paper"
summary: "Three candidate notations extend the pen-and-paper T-table to show Rust moves, copies, borrows, and the intervals in which a place may be used."
# show: false
---

# Tracing Rust: Ownership, Borrows, and Lifetimes on Paper

This is a continuation of [Tracing Algorithms](/blog/interview_03_tracing).
That post uses a name/value T-table: add a row when a name is introduced,
cross out an old value on overwrite, draw heap values to the right, and use
horizontal lines for calls and blocks. Here I try three ways to add Rust's
ownership rules without losing that statement-by-statement workflow.

**This material has not been tested with learners.** These are candidate
notations, not a validated teaching method. The recommendation near the end
is a hypothesis to test.

## First, separate four operations


| Operation | Statement | Type of `var_b` | Owner | `var_b` receives | Access |
|---|---|---|---|---|---|
| Move | `let var_b = var_a;` | `T: !Copy` | `var_b` | The value | `var_a`: none, `var_b`: full |
| Copy | `let var_b = var_a;` | `T: Copy` | Both | Bitwise copy | `var_a`: full, `var_b`: full |
| Borrow | `let var_b = &var_a;` | `&T` | `var_a` | A shared reference to `var_a` | `var_a`: read, `var_b`: reads |
| Mutable borrow | `let var_b = &mut var_a;` | `&mut T` | `var_a` | An exclusive reference to `var_a` | `var_a`: none until `var_b` dropped; `var_b` full |

“Copy” does not always mean “different referent.” References such as `&T` are
themselves `Copy`, so copying one produces another reference to the same
referent. The row above describes copying an ordinary value, such as an
integer or a `Copy` struct.

Three time intervals also need distinct names:

- **Binding Scope** the area where the variable can be used in code.
- **Value lifetime** the time from the value being initialized in memory until it has been freed in memory.
- **Borrow active** the region of code that a reference is allowed to be dereferenced.

A reference going out of scope does not destroy its referent. For types such
as `&T`, an end marker means “this binding or borrow is finished,” not that the
resource was dropped.

## Stage 0: what the old T-table misses

Consider a compiling program:

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

A language-neutral trace can follow the one allocation and its mutation:

```text
main
  phrase | 0x10 --------------------> [ h i ]
---------------------------------------------- shout
  word   | 0x10 --------------------> [ h i ]
  loud   | 0x10 --------------------> [ h i ]
  heap 0x10: ~~[ h i ]~~ -> [ h i ! ]
  return | 0x10 --.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX shout returns
                  `-----------------> result
main
  result | 0x10 --------------------> [ h i ! ]
```

The trace is useful, but incomplete. Its repeated address can look like three
simultaneously usable aliases. Rust says otherwise: `phrase` is unavailable
after the call, `word` is unavailable after `let mut loud = word`, and the
returned value belongs to `result`. Stage 0 therefore preserves the physical
story while failing to record the permission story. That is the gap the
candidate notations must fill.

## Candidate A: an ownership strip in the table

Add a narrow `state` strip to each binding's row. Append marks as the trace
grows; never erase earlier marks.

| Mark | Meaning |
|---|---|
| `O@s1` | This binding owns the value starting at statement 1. |
| `∅@s2` | Its value was moved at statement 2; the binding is no longer usable. |
| `&@s2` / `&m@s2` | A shared / mutable reference was created. |
| crossed-out `*` / `#` | A shared / mutable loan becomes inactive here. |
| `†@s4` | The binding's lexical scope ends; an owned value is destroyed here. |

```text
main                              s1: let art1 = Artwork { ... };
  name         | value  | state  s2: let borrowed = &art1;
  -----------------------------  s3: println!("{}", borrowed.name);
  art1         | 0x10   | O@s1   *@s2 ~~*@s3~~ †@s4
  borrowed     | &0x10  | &@s2   †@s4
```

This is easy to add to a familiar table and easy to draw incrementally. Its
weakness is visible above: a lifetime is encoded as statement labels to
compare, rather than as a length the reader can see.

## Candidate B: a lifeline graph

Replace rows with one vertical line per binding. A circle starts a binding,
a filled dot ends a source on move, a diamond ends a binding (and destroys an
owned value), and a dotted line represents a reference. Borrow brackets close
when the active loan ends, independently of the reference binding's diamond.

```text
         art1             borrowed
          (o)
           |
           D----------------(o)     shared borrow opens
           |                 .
           C.................:      active loan ends after last use
           |                 .
          <>                <>      lexical scope ends
```

The graph makes relative extent obvious. It is less faithful to the original
T-table, grows sideways as bindings are added, and has a subtle live-tracing
problem: the reader cannot know that a use is the *last* use without looking
ahead. The honest incremental choices are to leave the borrow open until
scope exit, or to close it later after examining subsequent code. The first
is conservative but can reject code Rust accepts; the second is back-editing.

## Candidate C: a margin ruler

Keep the T-table body and put narrow lifelines in its left margin. Each source
statement adds one horizontal slice to both parts.

| Ruler mark | Meaning |
|---|---|
| `o` | A binding begins. |
| solid stroke | An owning binding still has a value; borrow brackets refine its current access. |
| `.` | A reference binding is usable here. |
| `*` | Ownership moved away; no value is destroyed at this point. |
| `#` | An owned value is destroyed here. |
| `D` / `C` | A shared borrow opens / closes. |
| `>` / `<` | A mutable borrow opens / closes. |
| `:` | Direct access through the owner is suspended by an active mutable borrow. |
| `R` | A reference binding reaches lexical scope end. |
| `?` | The source requests an operation that the ruler says is unavailable. |

The examples below are a compact, reproducible version of the seven-program
set used for the recommendation. Except for the independent `Copy` example,
each `main` is compiled with this common setup:

```rust
struct Artwork {
    name: String,
    view_count: u32,
}

fn artwork(name: &str) -> Artwork {
    Artwork { name: name.to_string(), view_count: 0 }
}

fn admire_owned(art: Artwork) {
    println!("{}", art.name);
}

fn admire_shared(art: &Artwork) {
    println!("{}", art.name);
}

fn record_view(art: &mut Artwork) {
    art.view_count += 1;
}
```

### A plain owned value

```rust
fn main() {
    let art = artwork("Owain");
    println!("{}", art.name);
}
```

```text
art || main
 o  || art | 0x08 ----> [ Artwork { name: "Owain", view_count: 0 } ]
 |  || println!("{}", art.name)
 #  || end of main; art is destroyed
```

### A `Copy` value

```rust
fn main() {
    let a: i32 = 7;
    let b = a;
    println!("{a} {b}");
}
```

```text
a b || main
o   || a | 7
| o || b | 7
| | || println!("{a} {b}")
# # || end of main; two independent values end
```

### Move and use after move

```rust
fn main() {
    let art1 = artwork("Owain");
    admire_owned(art1);
    admire_owned(art1); // error
}
```

```text
art1 art || main
  o      || art1 | 0x10 ----> [ Artwork { name: "Owain" } ]
  *   o  || -------------------------------- admire
      |  || art  | 0x10 ----> [ Artwork { name: "Owain" } ]
      #  || XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX admire returns
  ?      || admire_owned(art1)  error: no live value in art1
```

The first call transfers the value. The `*` is not destruction; the `#` in
the callee is where that value would be destroyed. The second call has no
runtime trace because the program does not compile. The `?` records the
borrow checker's rejected operation, not an event that executes.

### Shared and mutable borrows

These are two complete `main` programs using the common setup:

```rust
fn main() {
    let art1 = artwork("Owain");
    let ref1 = &art1;
    admire_shared(ref1);
    let ref2 = &art1;
    admire_shared(ref2);
}
```

```rust
fn main() {
    let mut art1 = artwork("Owain");
    let mref1 = &mut art1;
    record_view(&mut *mref1);
    let mref2 = &mut art1;
    record_view(&mut *mref2);
    println!("{}", art1.view_count);
}
```

```text
art1 ref1 ref2 || shared-borrow program
  o            || art1 | 0x20 ----> [ view_count: 0 ]
  D    o       || ref1 | &0x20 ---> art1
  C    .       || admire_shared(ref1); last use closes first loan
  D    .    o  || ref2 | &0x20 ---> art1
  C    .    .  || admire_shared(ref2); last use closes second loan
  #    R    R  || lexical scope ends; art1 is destroyed
```

```text
art1 mref1 mref2 || mutable-borrow program
  o              || art1 | 0x20 ----> [ view_count: 0 ]
  >     o        || mref1 | &mut 0x20 -> art1
  <     .        || record_view(&mut *mref1); first loan closes, count becomes 1
  >     .     o  || mref2 | &mut 0x20 -> art1
  <     .     .  || record_view(&mut *mref2); second loan closes, count becomes 2
  |     .     .  || println!("{}", art1.view_count)
  #     R     R  || lexical scope ends; art1 is destroyed
```

The reference bindings remain lexically in scope after their last uses, but
their active loans end there. `C` and `<` close those loans; `R` separately
ends the reference bindings. Every binding has its own permanently labelled
column. In a live pen-and-paper trace, close a loan once later code establishes
that the preceding use was the last one. If the exercise forbids all
back-editing, conservatively extend the loan to scope exit and note that the
diagram then approximates Rust's non-lexical lifetime analysis.

### A move rejected while borrowed

```rust
fn main() {
    let art1 = artwork("Fire");
    let borrowed = &art1;
    admire_owned(art1);           // rejected: art1 is borrowed
    println!("{}", borrowed.name);
}
```

```text
art1 borrowed ||
  o           || art1    | 0x30 ----> [ Artwork { name: "Fire" } ]
  D      o    || borrowed | &0x30 ---> art1
  |      .    || admire_owned(art1)  ? move rejected while D is still open
  C      .    || println!("{}", borrowed.name); last use closes loan
  #      R    || end of scope; bindings end and art1 is destroyed
```

Do not draw the move, a callee value, or destruction of the artwork: the
compiler rejects the move, so ownership never transfers. The useful visual
conflict is an attempted move on a row where the shared-borrow span is open.

### Returning a reference to a local

The lifetime parameter below makes the intended (but impossible) promise
explicit: the caller may choose `'a`, yet the function tries to satisfy it
with a local value.

```rust
fn build_art<'a>() -> &'a Artwork {
    let art = artwork("Liberty");
    &art // error: returns a reference to data owned by this function
}

fn main() {
    let _art = build_art();
}
```

```text
art ret || build_art
  o     || art    | 0x40 ----> [ Artwork { name: "Liberty" } ]
  D  o  || return | &0x40 ---> art
  #  ?  || frame ends: art is destroyed, so ret cannot cross this line
```

Again, the failed return is a rejected operation, not a dangling reference
that exists at runtime.

## Draw order and recommendation

Candidate A preserves the table but makes lifetime comparisons symbolic.
Candidate B makes lifetimes easiest to see but replaces the established
notation and still cannot discover non-lexical borrow ends without looking
ahead. Candidate C adds detail rather than changing the table and makes
ownership transfer visible in the same row as the corresponding statement.

I would test Candidate C first, but with a narrower claim than “no
back-editing.” Moves, scope exits, and temporary call borrows are fully
incremental. Precise non-lexical borrow ends require either lookahead,
back-editing, or a conservative approximation in every candidate.

## What to test

Give readers the same small Rust programs in a mixed order: a plain owned
value, a `Copy` value, a move followed by use, two shared borrows, two mutable
borrows, a move attempted during a live borrow, and a reference returned from
a frame. Ask each reader to:

1. draw the trace with one ink color;
2. predict whether the program compiles;
3. point to the mark that supports that prediction; and
4. mark every place they looked ahead, erased, or revised an earlier mark.

Record correctness, drawing time, revisions, and questions asked. In
particular, compare a conservative scope-length borrow against a precise
last-use borrow. The recommendation remains untested until readers can use
the notation to make correct predictions.
