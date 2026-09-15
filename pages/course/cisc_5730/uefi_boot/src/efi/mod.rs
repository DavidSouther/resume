//! Hand-rolled bindings to the subset we touch - boot services for
//! alloc and files, text console, Block IO, and (read only) Graphics Output.
//!
//! ## `unsafe` boundaries
//!
//! This crate has exactly one real trust boundary: `efi_main`, the one
//! point where a caller this crate cannot itself review — firmware —
//! hands over a raw pointer. Every other function that takes one of these
//! pointers (`Shell::run`, `console::write_str`, `devices::enumerate`, and
//! so on) is called only from other code in this same crate, and every
//! such call site's `// SAFETY:` comment traces the pointer back to that
//! one boundary rather than re-arguing validity from scratch.
//!
//! `alloc_impl::init` is a deliberate exception: it stores its pointer
//! into `'static` global state that later `alloc`/`dealloc` calls can
//! then trust; otherwise, we'd need to create a pass-everywhere alloc
//! context.

pub mod block_io;
pub mod boot_services;
pub mod graphics;
pub mod runtime_services;
pub mod system_table;
pub mod text;
pub mod types;
