//! Hand-rolled bindings to exactly the subset of the UEFI Specification
//! (version 2.10) this project touches: boot services, the text console,
//! Block IO, and Graphics Output. No `uefi` or `r-efi` crate is used —
//! see the crate root docs for why.
//!
//! ## The ABI-prefix invariant
//!
//! Every `#[repr(C)]` struct in this module is deliberately truncated: it
//! declares only the fields this crate reads, in spec order, and stops.
//! The invariant every unsafe dereference of one of these structs relies
//! on — cited by name as "the ABI-prefix invariant" in this crate's
//! `// SAFETY:` comments — is that **firmware's real struct has the same
//! field order and types for the prefix we declare**, even though its real
//! struct continues past where ours stops.
//!
//! This holds because every field, in every struct here, is transcribed
//! directly from the UEFI Specification 2.10 in the order the spec
//! defines it (see each submodule's section citation), and `#[repr(C)]`
//! lays out a Rust struct exactly the way a C compiler would lay out the
//! equivalent declaration — same fields in, same offsets out. A struct
//! that declares a true prefix of another struct's fields, both `repr(C)`,
//! is therefore layout-compatible for that prefix regardless of what
//! either struct does afterward. Trailing fields we don't declare are
//! simply outside every struct we define; nothing here ever reads past
//! its own last declared field, so their existence in the real struct is
//! irrelevant.
//!
//! The second half of this invariant — that the pointers callers pass into
//! these structs actually point at *live* firmware tables in the first
//! place, not just correctly-shaped ones — comes from `# Safety`
//! contracts further up the call chain (`efi_main`'s, ultimately) and is
//! not part of the ABI-prefix invariant itself.
//!
//! ## Where `unsafe fn` stops
//!
//! This crate has exactly one real trust boundary: `efi_main`, the one
//! point where a caller this crate cannot itself review — firmware —
//! hands over a raw pointer. Every other function that takes one of these
//! pointers (`Shell::run`, `console::write_str`, `devices::enumerate`, and
//! so on) is called only from other code in this same crate, and every
//! such call site's `// SAFETY:` comment traces the pointer back to that
//! one boundary rather than re-arguing validity from scratch. Those
//! functions stay safe `fn`s with internal `unsafe` blocks; marking them
//! `unsafe fn` too would push the `unsafe` keyword around without adding
//! information a reader doesn't already get from following the chain.
//!
//! `alloc_impl::init` is the deliberate exception: it stores its pointer
//! into `'static` global state that later `alloc`/`dealloc` calls trust
//! with no parameter passing it down and no way to re-derive the chain
//! locally by reading the call stack — the pointer's provenance is
//! severed from its origin, unlike an ordinary parameter pass — so it
//! gets its own `# Safety` section rather than riding on this policy note.

pub mod block_io;
pub mod boot_services;
pub mod graphics;
pub mod system_table;
pub mod text;
pub mod types;
