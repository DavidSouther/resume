# Intent review 2: research.md (Research-phase blind-spot variant, cold)

*Anchor: research.md "Topic and Intent" verbatim quotes (no `.ailly/prompts/` file supplied).*
*Dispatch note: cold, memory-less reviewer. Questions were formed from research.md alone; prior entries (IR-1 to IR-3) were read only afterwards for dedup.*

Candidates dropped as already raised or settled: rootfs extract vs. hand-built `ldd` copy (Decision 4), macOS role (Decision 5 and the second request's target list), IPC namespace (Decision 10), host architecture (IR-2 / Decision 6), course question list (IR-1 / Decision 7), first commit (IR-3 / Decision 9). The Option A vs. B choice itself is Decision 1; IR-4 raises only the drift in the recommendation, not the choice.

---

### 2026-10-07 — IR-4 — Research gap (blind spot): the recommendation removes "clone" from a request whose core is "clone and chroot sys calls"

Inside the frame we have now built, what would we no longer notice is missing? The request says "The core requirements are safe rust, clone and chroot sys calls", listing `clone` beside "safe rust" as an equal core requirement, and asks to "discuss clone vs clone3, flag choices". Our research read "safe Rust" as "zero `unsafe` in the crate" (`#![forbid(unsafe_code)]`) and, on that reading, recommends Option A, which never calls `clone(2)`. As recommended, the program will create namespaces with `unshare` and spawn through `std::process::Command`. The clone-vs-clone3 analysis, the `clone` flag set, and the lecture's "explain what each flag does" would then describe a syscall our code does not make, and a non-namespace flag such as `CLONE_IO` cannot be passed at all, because `unshare` does not accept it. Research did not consider that "safe Rust" might mean "safe Rust with one audited `unsafe` boundary" (Option B, youki's pattern), which keeps both core requirements. Which did you mean by "safe rust": no `unsafe` at all, or memory-safe Rust with a small, justified `unsafe` module around `clone`? If the latter, should research's recommendation flip to B?

**Status:** open

### 2026-10-07 — IR-5 — Research gap (blind spot): "flag choices" narrowed to namespace flags only

The request asks to discuss "flag choices" and floats "Probably start with CLONE_IO?". `CLONE_IO` is a resource-sharing flag, not a namespace flag. Our research oriented on the namespace set (`NEWPID|NEWNS|NEWUTS|NEWIPC` + `SIGCHLD`) and rejected `CLONE_IO` correctly, but stopped there. The sharing and control flags were never discussed: `CLONE_VM`, `CLONE_VFORK`, `CLONE_FILES`, `CLONE_FS`, `CLONE_SIGHAND`, `CLONE_PARENT`, `CLONE_PIDFD`, `CLONE_PARENT_SETTID`, and `CLONE_CHILD_CLEARTID`. Each of these is a real choice for a literal `clone` call, especially `CLONE_VFORK` and `CLONE_VM` on a shared stack, and `CLONE_FILES`, which bears directly on I/O. Orienting on isolation flags has made the other half of the `clone` flag word invisible. Did "flag choices" mean the full `clone` flag word, with a stated reason for leaving each flag off, or only which namespaces to create?

**Status:** open

### 2026-10-07 — IR-6 — Research gap (blind spot): what "Probably start with CLONE_IO?" was reaching for

Research answered the literal question ("`CLONE_IO` is disk-scheduler context, not stdio") and recorded "drop `CLONE_IO`" as settled. It did not ask what the suggestion was reaching for. In the same sentence the request pairs `CLONE_IO` with "io redirection", which suggests you may have meant "start with the I/O plumbing", or a flag that governs file descriptors, such as `CLONE_FILES`. Research settled the flag and never asked about the intent behind it. Was `CLONE_IO` meant as "begin with stdio wiring, the first milestone being a child whose output reaches the terminal", or did you want the disk-I/O-context behavior itself demonstrated and explained, for example in the report's "what each flag does"?

**Status:** open

### 2026-10-07 — IR-7 — Research gap (blind spot): I/O redirection framed as stdio only, leaving inherited descriptors and chroot escape invisible

Research treats "io redirection" as how fds 0, 1, and 2 reach the child (inherit, pipes, pty). As designed, the child inherits every descriptor the launcher has open across `clone`/`exec`, not only 0–2. Research separately notes that plain `chroot` is escapable, but it never connects that to I/O. An inherited directory fd, or any fd opened on the host filesystem before the `chroot` that lacks `O_CLOEXEC`, lets the container reach the host tree with `fchdir` or `openat`, regardless of `pivot_root`. Research also does not cover shell-level redirection through the container (`bcdocker run c /bin/ls > out.txt`, `cat file | bcdocker run c /bin/wc`) or whether the launcher must preserve it. Should "io redirection" cover fd hygiene, meaning closing or `CLOEXEC`-marking everything above fd 2 before entering the container, and the host-side redirection and pipe cases, in addition to the terminal cases?

**Status:** open

### 2026-10-07 — IR-8 — Research gap (blind spot): the clone3 rejection rests on seccomp, which the chosen Docker mode disables

Research rejects `clone3` mainly because Docker's default seccomp profile forces `ENOSYS` [12]. The same research also decides that the Docker-on-Mac target runs with `--privileged`, which turns off seccomp. Under that decision the main argument against `clone3` no longer applies. What remains is "no glibc wrapper" and "no safe Rust binding", and the second applies to `clone` too. As written, the clone-vs-clone3 discussion the request asked for reaches a conclusion that the platform decision undercuts. Research also does not note that, under Option A, glibc's `posix_spawn` and Rust std may themselves use `clone3` internally, so Option A does not guarantee "not clone3". Do you want the comparison re-argued on grounds that hold for the actual targets (the bookworm VM and privileged Docker), such as API shape, `CLONE_PIDFD`/`CLONE_INTO_CGROUP`, binding availability, and teaching value, so the report's justification holds up?

**Status:** open

### 2026-10-07 — IR-9 — Research gap (blind spot): "bookworm-slim VM" and the two native hosts never get a build-and-run path

The request separates host platforms ("MacOS native & Debian native") from target platforms ("bookworm-slim VM and bookworm-slim in docker on Mac"). Research's platform table merges them. Its first row is "Debian VM (`bookworm-slim` VM, native)", which treats the Debian native host as the VM target. The Debian native host gets no row of its own. Research never establishes what a "bookworm-slim VM" is ("slim" is a Docker image tag, not an installer), which hypervisor runs it (Lima, UTM, or QEMU/KVM on the Debian host), or which host it runs on. It also never covers how the binary and rootfs get from each host into each target (cross-compile from macOS, or build inside the target). Research also never asks whether Debian native is itself a run target or build-only. Orienting on "can the kernel do namespaces here" has hidden the host-to-target matrix. Which host runs the bookworm-slim VM, how is that VM built, and is the Debian native host also expected to run containers directly?

**Status:** open
