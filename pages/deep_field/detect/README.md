# Deep Field detector

This Cargo workspace contains two GPLv3 crates:

- `deep-field-core` (`core/`): background estimation, filtering, extraction,
  deblending, cleaning and moments. It builds without dependencies by default;
  the optional `serde` feature enables serialization of measured objects.
- `deep-field-detect` (`src/`): the page's colour measurements, star finder,
  classification and fragment grouping, plus the WASM exports consumed by the
  browser worker. It depends on the core and enables its `serde` feature.

From the repository root, `mise run test:rust` tests both crates and the core
without serialization. `npm test` runs those tests before the website tests.
`mise run wasm` builds the browser module at its existing URL.

CI runs the Rust tests and SEP feature suite only when Deep Field sources,
assets, or shared build/test configuration change. Other site tests still run
on every PR. Site builds reuse an exact cache of the generated WASM, keyed by
Rust sources, Cargo manifests/lockfile, toolchain and build configuration; a
cache miss compiles it. Cargo build files and Python downloads are also cached.
Deployments that reuse an approved site artifact seed main's WASM cache from
that artifact, so later PRs can reuse it. `npm run build:site` assembles the site
from those prepared WASM files; `npm run build` also builds WASM for local use.

The detector follows the SExtractor method, described in [Bertin & Arnouts
1996, "SExtractor: Software for source extraction", A&AS 117, 393](https://doi.org/10.1051/aas:1996164).
[SEP](https://github.com/sep-developers/sep) is the C library implementing that
method, and is the reference implementation for this port.

`oracle/sep_oracle.py` compares against SEP as a black box. Website tests check
approximate centroid/area agreement on the bundled image and retention of faint
sources on independent synthetic images. These checks do not establish full SEP
compatibility or photometric accuracy.
