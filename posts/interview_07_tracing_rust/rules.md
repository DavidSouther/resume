General value table to track stack & heap state:
1. Check variable names in the table.
2. Evaluate expressions.
3. Update the table.
4. Follow control flow.
5. Repeat until finished!

Rust ownership and lifetime tracking:
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