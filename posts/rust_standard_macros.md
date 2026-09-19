---
title: Rust Standard Macros
date: 2026-09-19
summary: An overview of the most common Rust macros for developers new to the language. Instead of starting with how to write macros, we begin by looking at the macros most commonly used.
---

An early complaint developers with experience from other languages have when coming to Rust is the
lack of variadic function arguments. Rust has no language mechanism to overload a function, or to
allow a function to take "the rest" of the arguments at runtime. All functions must have well-known
types and sizes at compile time. Generics handle some of this, allowing function callers to
specialize by argument type, but the function must already be written with certian generic bounds in
mind. Rust has something that's actually far more powerful.

The Rust macro system allows developers to create complex "mini" languages and DSLs inside their
program. The Rust standard library provides a number of these that set the pattern and best practice
for common cases. Most discussions start with the macro definition syntax, so this post instead
looks at the most common macros Rust developers use. 

## Declarative and Attribute Macros

Declarative macros in Rust are obvious from two indications - first, they use an `!`, and second,
they're always inline. Common examples are [`println!`](https://doc.rust-lang.org/std/macro.println.html)
for standard output and [`vec!`](https://doc.rust-lang.org/std/macro.vec.html) to create a
statically initialized vector. These sometimes look like functions, `println!("Hello, {name}")`.
`vec![2, 4, 6]` uses square brackes to "look like" an array literal. Rust does allow curly brackets,
but are much less commonly used.

Declarative macros are used inline, and often as a shorthand to simplify syntax for complex
expressions. The macros we see in the standard library for the most part all evaluate to an
expression with a value and a type, but that value and type depend entirely on what's passed in.
This can sometimes be difficult to reason about, especially by the compiler and language server, so
you might find yourself adding extra type hints when inference can't quite get the job done. While
it's generally considered bad practice to do complex logic or computation inside a declarative
macro's body, and while the standard library macros don't, it is a complete grammar and macros
provided by third party crates may not be as well behaved.

Attribute macros wrap entire blocks, typically functions or structs, and add substantial new
functionality to their argument. Atribute macros are similar to annotations and decorators in other
languages. 

## Common Declarative Macros

### `println!`, `dbg!`, `tracing::{log, info, trace, warn, debug}`

[`println!`](https://doc.rust-lang.org/std/macro.println.html) is the first macro most Rustaceans encounter, and it's an excellent example of what power
Rust macros can unlock. `println!` takes one mandatory argument, a format string, and any number of
additional arguments which will be used when formatting said string. The format string is itself a
mini formatting DSL, akin to C's `printf` but less flexible than Go's `gotmpl`.

The formatting language is build around curly braces `{}` for interpolation. Without anything else,
`println!` will take the next positional argument in its inputs, call `fmt` from the
[`Display`](https://doc.rust-lang.org/std/fmt/trait.Display.html) trait, and replace the `{}` with
that string. The curly braces can take additional commands to change how the argument is converted
to a string. `{:?}` calls `fmt` from the [`Debug`](https://doc.rust-lang.org/std/fmt/trait.Debug.html) trait.

Before the `:` you can provide either a single name in scope, or an integer positional argument
starting at 0. Note that general expressions are not allowed inside the format string; if you want
to format the result of someting more, use the positional arguments. These arguments are eagerly
evaluated.

Additional arguments can specify padding, alignment, and other details. See
[`format!`](https://doc.rust-lang.org/std/macro.format.html) for the full details.

`println!` writes directly to the standard output file descriptor, adding an ending `\n` newline.
[`eprintln!`](https://doc.rust-lang.org/std/macro.eprintln.html) writes to the standard error file
descriptor with a newline. [`print!`](https://doc.rust-lang.org/std/macro.print.html) and
[`eprint!`](https://doc.rust-lang.org/std/macro.eprint.html) do the same, without additional newlines.

[`dbg!`](https://doc.rust-lang.org/std/macro.dbg.html) like `eprintln!` uses the `Debug` trait, but
it only takes a single expression, it includes the file, line, and column in the output, and it
returns the expression. It can always be used inline for print-line debugging.

In production code, you should not be using `println` or any of these direct-to-standard-output
utilities. The [`tracing`](https://docs.rs/tracing/latest/tracing/) crate from the community follows
a very similar design, but makes two drastic improvements. It separates log generation from log
emitting, and it adds structured logging rather than direct string formatting.  In code, this could
look like `info!(user_id=42, "logged in")` or `warn!(timeout=elapsed, "timeout exceeded")`. The
[`log`](https://docs.rs/log/latest/log/) crate provides a similar API. Choosing between the `log`
and `tracing` ecosystems is largely project dependent; `tracing` is considered newer with more
support, but `log` is simpler for common use cases.


### `write!`, `format!`

`format!` shows the thoughtful structuring of the Rust standard library. The
[`format!`](https://doc.rust-lang.org/std/macro.format.html) macro has an ecosystem of complementary
formatting traits, which allow each type to decide how best to represent itself in various scenarios.
Then, other macros can defer to `format!` for consistent string building while handling the target
of that themselves.

[`write!`](https://doc.rust-lang.org/std/macro.write.html) is the next step from `println!`. While
`println!` assumes the standard output file descriptor (and panics on failure), `write!` requires a
target sink and provides a `Result` type for error handling and chaining on failure.

Beware, however - there are two `write!`s! [`std::fmt::Write`](https://doc.rust-lang.org/std/fmt/trait.Write.html)
takes a mutable string as a target, and creates the string in memory. You might prefer directly
using `format!` in that case. [`std::io::Write`](https://doc.rust-lang.org/std/io/trait.Write.html)
is for using `write!` with an open file handle directly.

### `assert!`, `assert_eq!`, `assert_ne!`, `assert_matches!`

The [assert](https://doc.rust-lang.org/std/macro.assert.html) macros verify their argument is true
or [`panic!`](https://doc.rust-lang.org/std/macro.panic.html) otherwise. These can go anywhere in
code. Don't put them in production. Keep them in tests. `panic!` means the entire program must end
immediately, and any further computation is unsafe. This is (almost) never what you want. But in
test code, [`assert_eq!`](https://doc.rust-lang.org/std/macro.assert_eq.html) and
[`assert_ne!`](https://doc.rust-lang.org/std/macro.assert_ne.html) provide beautiful automatic debug
diffs of the things that failed.

[`assert_matches!`](https://doc.rust-lang.org/std/assert_matches/macro.assert_matches.html) builds
on the [`matches!`](https://doc.rust-lang.org/std/macro.matches.html) macro (which returns a
boolean) by panicing and printing a structure output of the failed match. The `matches!` macro is a
way to simplify a `match` expression `match foo { bar => true; _ => false }` could be
`matches!(foo, bar)`.

### `env!`, `include_str!`

At build time, we may want to include some information into the binary of our program.

[`env!`](https://doc.rust-lang.org/std/macro.env.html) provides compile-time environment variable
lookup. It fails to compile if `var` is absent on the building machine. For runtime environment
variables, [`std::env::var`](https://doc.rust-lang.org/std/env/fn.var.html) returns an `Option` on
the running machine. [`option_env!`](https://doc.rust-lang.org/std/macro.option_env.html) allows
compiling and provides an `Option` with the result of the compiling machine's environment.

[`include_str!`](https://doc.rust-lang.org/std/macro.include_str.html) &
[`include_bytes!`](https://doc.rust-lang.org/std/macro.include_bytes.html) embed a file's contents into the binary at compile time. This is
excellent for loading static assets at compile time. SQL files, templates, and base configs are
excellent candidates. By pulling them directly into the binary, some `const` functions can work on
them, they don't need to be managed with the release, and they don't require additional I/O on the
runtime. They do, of course, increase the binary size. Game assets should probably not be included
this way, nor should anything that might need to be changed during the course of deployment.

### `todo!`, `unimplemented!`, `unreachable!`

Three different ways to say `panic!`, each communicating to the reader what's up. All of them allow
a block to compile, pushing errors to runtime. [`todo!`](https://doc.rust-lang.org/std/macro.todo.html)
is used early indevelopment. Say you're implementing a trait for a struct, and the trait has four
methods. You're only working on one of them. So you'd stub out all four for the compiler, then add
`todo!` for the three you don't yet need, and come back before submitting when you're done.

[`unimplemented!`](https://doc.rust-lang.org/std/macro.unimplemented.html) is to say "this function
will never be implemented" - it's dangerous, but not strictly "unsafe".
[`unreachable!`](https://doc.rust-lang.org/std/macro.unreachable.html) is a safety pinky-promise to
the compiler. You the programmer have verified and guarantee this code path cannot ever be reached,
even though the logic in the program technically allows it.

## Common Attribute Macros

### `derive`

Common traits ([Rust Book Appendix C](https://doc.rust-lang.org/book/appendix-03-derivable-traits.html))
have "obvious" implementations "most" of the time (say, 9 times out of 10?). Instead of making the
developer write them, [Attribute macros](https://doc.rust-lang.org/reference/attributes/derive.html)
introspect the struct and fill in the obvious implementations for the trait. This works for
ecosystem crates as well - [Serde](https://serde.rs/derive.html), [Clap](https://docs.rs/clap/latest/clap/_derive/index.html),
and [ThisError](https://docs.rs/thiserror/latest/thiserror/) all make excellent use of the automated
Derive features.

`#[derive(Debug, Clone, Defualt, Hash, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]` is
about the same functionality as Python's `@dataclass`. `#[derive(Error)]` from thiserror turns an
enum into a typed error variant with minimal extra work.
[`#[derive(Parser)]`](https://docs.rs/clap/latest/clap/trait.Parser.html) from clap builds an `argv`
argument parser for strings to structs.

Derive can fail to compile for reasons that look like ordinary trait-bound errors.
`#[derive(Debug)]` will create an implementation that calls `debug` on each property, so if any one
field of the struct isn't `Debug`, the `derive` will fail. This happens probably most often with
[`Default`](https://doc.rust-lang.org/std/default/trait.Default.html), in which case you may need to
provide your own impl for `Default` which chooses a correct default value for a non-default property
type.

### `test`

[`#[test]`](https://doc.rust-lang.org/reference/attributes/testing.html) marks a function as a unit
test, picked up by `cargo test`.  Equivalent to JUnit's `@Test` or pytest's discovery convention, but
zero-config. No test classes or decorators, but unit tests should be within a
`#[cfg(test)] mod test { }` block. Add `#[ignore]` to skip a test. Add `#[should_panic]` if the test
is explicitly testing for a panic case (but you probably can find a better design to not need it).

### Etc.

[`#[cfg(...)]`](https://doc.rust-lang.org/reference/conditional-compilation.html) /
`#[cfg(target_os = "...")]` / `#[cfg(feature = "...")]` for conditional compilation. `target_os`
allows changing based on the compilation target. `feature` allows compile time choosing to add or
remove behavior based on which project features are enabled or disabled in the Cargo.toml.
`#[cfg(test)] mod test { ... }` is the common pattern for unit tests in the same file as the
implementation.

[`#[allow(...)]` / `#[warn(...)]` / `#[deny(...)]`](https://doc.rust-lang.org/reference/attributes/diagnostics.html)
for lint control. Obiously you shouldn't just override them, but this might help when the rule is
too strict or to quiet down during development.

[`#[tokio::main]`](https://docs.rs/tokio/latest/tokio/attr.main.html) and
[`#[tokio::test]`](https://docs.rs/tokio/latest/tokio/attr.test.html) are Tokio crate specitic
attributes for `async fn main` and `async fn test_foo`. If you're using Tokio, and the thing is
async, these will be necessary. Each sets up a reasonable Tokio executor to run your async code.

[`#[non_exhaustive]`](https://doc.rust-lang.org/reference/attributes/type_system.html#the-non_exhaustive-attribute)
signals to consumers of a struct/enum that more fields/variants may be added later.