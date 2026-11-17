# Deep Field detector

This Cargo workspace contains two GPLv3 crates:

- `deep-field-core` (`core/`): background estimation, filtering, extraction,
  deblending, cleaning and moments. It builds without dependencies by default;
  the optional `serde` feature enables serialization of measured objects.
- `deep-field-detect` (`src/`): the page's colour measurements, star finder,
  classification and fragment grouping, plus the WASM exports consumed by the
  browser worker. It depends on the core and enables its `serde` feature.

From the repository root, `mise run test:rust` tests both crates and the core
without serialization. The general `npm test` runs site tests independently.
`mise run wasm` builds the browser module at its existing URL.

CI runs the Rust tests and SEP feature suite when Deep Field sources, assets,
or shared build/test configuration change. On main, the Deep Field workflow
publishes its WASM bundle for site builds and triggers a deployment. Run that
workflow once to create the `deep-field-wasm` release before the first site
build. `npm run build:site` assembles the site from prepared WASM files;
run `mise run wasm` separately to build the detector for local use.

`oracle/sep_oracle.py` compares against SEP as a black box. Website tests check
approximate centroid/area agreement on the bundled image and retention of faint
sources on independent synthetic images. These checks do not establish full SEP
compatibility or photometric accuracy.
