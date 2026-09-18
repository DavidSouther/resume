---
title: "Tracing Rust: Ownership, Borrows, and Lifetimes on Paper"
summary: "Five candidate notations extend the pen-and-paper T-table to show Rust moves, copies, borrows, and the intervals in which a place may be used."
show: false
---

## Four operations

| Operation | Statement | Data address | Type | Owner of the data | Value in `var_b` | Access after the statement |
|---|---|---|---|---|---|---|
| Move | `let var_b = var_a;` | Same | Same | Now `var_b` | Same bytes | `var_a`: none; `var_b`: full |
| Copy | `let var_b = var_a;` | New | Same | Both, independently | Equal bytes | Both full |
| Borrow | `let var_b = &var_a;` | Same referent | New: `&T` | Still `var_a` | Reference to `var_a` | `var_a`: read; `var_b`: read |
| Mutable borrow | `let var_b = &mut var_a;` | Same referent | New: `&mut T` | Still `var_a` | Reference to `var_a` | `var_a`: none for the loan; `var_b`: read and write |

“Copy” does not always mean “different referent.” References such as `&T` are
themselves `Copy`, so copying one produces another reference to the same
referent. The row above describes copying an ordinary value, such as an
integer or a `Copy` struct.

Every `let` creates a new binding slot, so a separate “binding location”
column would always say “new.” “Data address” instead tracks the data a binding
designates. Rust specifies ownership and access, not whether an optimizer keeps
those bytes at any particular machine address; the address column is a tracing
relationship, not a layout guarantee.

Three time intervals also need distinct names:

- **Binding Scope** the area where the variable can be used in code.
- **Value lifetime** the time from the value being initialized in memory until it has been freed in memory.
- **Borrow active** the region of code that a reference is allowed to be dereferenced.

A reference going out of scope does not destroy its referent. For types such
as `&T`, an end marker means “this binding or borrow is finished,” not that the
resource was dropped.

## Runtime vs compile time

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

```mermaid
main
  name    | value
  phrase  | 0x10 ------> [ String "hi" ]

  ---------------- shout ----------------
  word    | 0x10 ------> [ String "hi" ]
  loud    | 0x10 ------> [ String "hi!" ]
  return  | 0x10 ------> [ String "hi!" ]
  <--------------- return arrow ---------

  result  | 0x10 ------> [ String "hi!" ]
```

The trace is useful, but incomplete. Its repeated address can look like three
simultaneously usable aliases. Rust says otherwise: `phrase` is unavailable
after the call, `word` is unavailable after `let mut loud = word`, and the
returned value belongs to `result`. Using the following procedure, we can
trace ownership in code while also tracing memory.

# Value Trace

1. Check variable names in the table.
2. Evaluate expressions.
3. Update the table.
4. Follow control flow.
5. Repeat until finished!

# Ownership

1.  Read a single function line by line.
2.  For each variable in a `let` binding (`let`, `fn` args, `match`, `if let`, `while let`, `for`)
    1.  Choose a color.
    2.  Highlight the variable with this color.
    3.  From this point, highlight every instance of the variable with this color until either
        1. it gets moved.
        2. it gets dropped (last `}` at the same level of the `let`).
        3. it gets returned (either the `return` call or more liklely _after_ the closing `}` for the `fn`).
    4.  At the `let` binding, start a new gutter column from left to right.
        1. If the right hand side is a reference (`&` or `&mut`), draw it touching the variable it came from.
        2. If the right hand side is `copy`, draw the new column separate from the variable it came from.
    5.  Highlight the gutter column from the first `let` line to the last line it's used (or the end of the block).
    6.  If the `let` was a mutable reference binding, for all columns left of it, draw a light crosshatch.
3.  Review for errors:
    1.  If a reference gutter continues beyond the `move` or `drop` of any owners to the left.
    2.  If a variable is accessed while it's crossed out by a mutable reference.

TODO: Include `<'a>` lifetime annotations in Heap items.


### A plain owned value

The one yellow band begins where `art` is declared and ends on the final
in-scope source line. Its rounded endpoints carry all the necessary start and
end information; the memory view connects the local binding to its heap value.

```highlight-gutters
code rust:
fn main() {
    let art = artwork("Owain");
    println!("{}", art.name);
}
marks:
art 1,2
```
```mermaid
traceDiagram
  title A plain owned value
  heap artwork 0x08
    name: Owain
    view_count: 0
  end
  frame main
    art: @artwork
    watch art.name: Owain
    done
  end
```

### A `Copy` value

The yellow `a` band and blue `b` band overlap legally: copying an `i32` creates
two independent values. Both bands end on the final in-scope source line.

```highlight-gutters
code rust:
fn main() {
    let a: i32 = 7;
    let b = a;
    println!("{a} {b}");
}
marks:
a 1,3
b copy a 2,3
```
```mermaid
traceDiagram
  title Copy creates independent values
  frame main
    a: 7
    b: 7
    watch println a b: 7 7
    done
  end
```

### Move and use after move

“Use after free” is useful shorthand for the danger, but safe Rust rejects the
second use before such a runtime state exists. The yellow `art1` band ends at
the first `admire_owned(art1)` because that call moves the value. A horizontal
move cap marks the transfer; no callee band is needed. The rejected second call
has no band because `art1` no longer owns a value.

```highlight-gutters
code rust:
fn main() {
    let art1 = artwork("Owain");
    admire_owned(art1);
    admire_owned(art1); // rejected: already moved
}
marks:
art1 1,2 move
reject 3
```
```mermaid
traceDiagram
  title Ownership check for use after move
  heap artwork 0x10
    state: alive, freed by admire_owned
  end
  frame main
    art1: @artwork, moved
    watch first admire_owned: accepted, moves art1
    frame admire_owned
      art: @artwork
      done
    end
    watch second admire_owned: rejected
  end
```

The source name remains lexically in scope, but its ownership band has ended.
The memory diagram supplies the callee-frame detail without adding a misleading
second gutter lane. Together they distinguish scope, ownership, and value lifetime.

### Shared borrows

The owner and both reference bindings have distinct colors. Under the lexical
teaching rule, each reference band continues to the final in-scope source line;
their overlap is legal because both request shared access. Because the owner
and reference bands touch, each new reference adds another step to the sideways
pyramid without needing a separate connector.

```highlight-gutters
code rust:
fn main() {
    let art1 = artwork("Owain");
    let ref1 = &art1;
    let ref2 = &art1;
    admire_shared(ref1);
    admire_shared(ref2);
}
marks:
art1 1,5
ref1 &art1 2,5
ref2 &art1 3,5
```
```mermaid
traceDiagram
  title Compatible shared borrows
  heap artwork 0x20
    name: Owain
    view_count: 0
  end
  frame main
    art1: @artwork
    ref1: &0x20
    ref2: &0x20
    watch admire_shared ref1: allowed
    watch admire_shared ref2: allowed
    done
  end
```

### Mutable borrows

Each mutable reference lives in its own inner block. The blue `mref1` and pink
`mref2` bands therefore never overlap; each runs from its declaration through
the final source line before its own closing brace. The touching blocks alone
show each step away from the owner. While either mutable loan is active, the owner's yellow
band switches to a hatched fill with dashed edges, showing that direct owner
access is suspended.

```highlight-gutters
code rust:
fn main() {
    let mut art1 = artwork("Owain");
    {
        let mref1 = &mut art1;
        record_view(&mut *mref1);
    }
    {
        let mref2 = &mut art1;
        record_view(&mut *mref2);
    }
}
marks:
art1 1,9
mref1 &mut art1 3,4
mref2 &mut art1 7,8
```
```mermaid
traceDiagram
  title Sequential mutable borrows
  heap artwork 0x20
    name: Owain
    view_count: 0, 1, 2
  end
  frame main
    art1: @artwork
    scope first mutable loan
      mref1: &mut 0x20
      watch view_count: 1
      done
    end
    scope second mutable loan
      mref2: &mut 0x20
      watch view_count: 2
      done
    end
    done
  end
```

### Move while borrowed

The blue `borrowed` band remains open across the attempted move and touches the
yellow `art1` band as its next outward step. Because the blue band crosses the bold rejected
call, the attempted move cannot terminate the owner band. Rust rejects the
operation before it can create a callee or runtime state.

```highlight-gutters
code rust:
fn main() {
    let art1 = artwork("Fire");
    let borrowed = &art1;
    admire_owned(art1); // rejected: art1 is borrowed
    println!("{}", borrowed.name);
}
marks:
art1 1,3
borrowed &art1 2,4
reject 3
```
```mermaid
traceDiagram
  title Move rejected while borrowed
  heap artwork 0x30
    name: Fire
    view_count: 0
  end
  frame main
    art1: @artwork
    borrowed: &0x30
    watch admire_owned art1: rejected
    watch borrowed.name: Fire
    done
  end
```

### Returning a stack pointer: Rust's returned local reference

“Return a stack pointer” is the familiar systems-programming failure. In safe
Rust, the analogous source tries to return a reference to a stack-local value.
The touching gutter bands show the attempted reference stretching from the
callee's `&art` return into the caller, while the trace makes the same rejected
stack pointer explicit. Its `ret` row contains `&art` and points back to the
`art` row inside `build_art`, while the return arrow reaches `my_art` in the
caller's frame. Rust rejects this before a dangling runtime state exists.

```highlight-gutters
code rust:
fn build_art<'a>() -> &'a Artwork {
    let art = artwork("Liberty");
    &art // rejected return
}

fn show_art(show: &Artwork) {
  println!("{}", show.name);
}

fn main() {
    let my_art = build_art();
    show_art(&my_art);
}
marks:
art 1,2
my_art &art 2,11
show &my_art 5,6
reject 2
```
```mermaid
traceDiagram
  title Static check of a returned local reference
  frame main
    my_art:
    frame build_art
      art: Artwork Liberty
      ret &art -> my_art
      watch return: rejected
      done
    end
  end
```

The `build_art` frame boundary makes the bug concrete: returning would leave
`my_art` pointing into a callee frame whose local storage has ended. There is no
dangling pointer at runtime because no return executes; the `ret` row preserves
the rejected stack-pointer relationship for inspection.

Candidate CD remains a statement-by-statement paper method whose
meaning survives without its reinforcing palette. It has
not been tested with learners.
