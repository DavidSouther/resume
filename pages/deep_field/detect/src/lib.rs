//! Source detection for the Deep Field Volume page.
//!
//! Two layers:
//! - [`core`]: background, matched-filter detection, deblending, cleaning and
//!   moments, following the SExtractor method and agreeing with SEP.
//! - [`page`]: the page's own stages (diffraction-spike star finder, near, mid
//!   and far classification, near-galaxy fragment grouping, colour).
//!
//! The WASM exports live in [`wasm`].

pub mod core;
pub mod page;
mod wasm;

pub use wasm::{detect, detect_core, Detection};
