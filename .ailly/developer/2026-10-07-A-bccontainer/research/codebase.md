# research:codebase — local conventions for a new Rust project under pages/course/cisc_7310

*2026-10-07.*

- Target folder `pages/course/cisc_7310/bccontainer` does not exist yet. Siblings: `bootloaders/` (asm + Makefile) and `uefi_boot/` (Rust).
- `uefi_boot/Cargo.toml`: edition 2021, a single small dependency (`thiserror` 2, no default features), `panic = "abort"` in both profiles, `opt-level = "s"` for release.
- `uefi_boot/Makefile`: `.DEFAULT_GOAL := build`; targets `install`, `build`, `run`, `run-loop`. It branches on `uname -s` (`Darwin` uses Homebrew; `Linux` requires `/etc/debian_version` and uses apt via sudo when not root). This is the existing pattern for "macOS and Debian hosts". The macOS side works because the actual target runs in an emulator (QEMU), so macOS acts as the dev host. The same split fits here: the container runtime runs on Linux, either Debian native or Debian in Docker.
- `uefi_boot/README.md` opens with a terminal transcript of the tool in use, then explains it. Has `.gitignore` and `.vscode/`.
- Repo-wide `AGENTS.md` covers the Node/TypeScript site and is not relevant to this Rust crate, except that `pages/` content may be published by the site build (not verified for Rust project folders).
- Git history for `pages/course/cisc_7310`: one commit, `1b5e939 Renumber OS to masters course track`. The course projects live inside the resume repo, not in a separate repo. The assignment, however, requires a GitHub Classroom repository with `README.md`, `src/`, `doc/` at its top level [1]. How the folder maps to that repository is open.

## Sources

[1] H. Chen, "Project 2: Application Container," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer
