//! Hand-rolled bindings to exactly the subset of the UEFI Specification
//! (version 2.10) this project touches: boot services, the text console,
//! Block IO, and Graphics Output. No `uefi` or `r-efi` crate is used —
//! see the crate root docs for why.

pub mod block_io;
pub mod boot_services;
pub mod graphics;
pub mod system_table;
pub mod text;
pub mod types;
