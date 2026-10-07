# research:public — BCDocker assignment requirements, container mechanisms, platforms

*2026-10-07. Expand pass (general lens) plus a direct read of every course page the assignment links.*

## Query expansion (Jeopardy!)

- Assignment: "bccontainer", "BC Docker", "Application Container Launcher", "Project 2", the course schedule, the assignments list, the syllabus, the linked tutorial video, the lecture "Processes Isolation and Application".
- Mechanism: "chroot jail" / "PID namespace" / "CLONE_NEWPID" / "process IDs start from 1" / "container from scratch".
- Platform: "docker seccomp unshare" / "mount proc inside docker" / "macOS chroot dyld shared cache" / "macOS namespaces".
- Rust: "nix clone CloneFlags" / "container in Rust" / "youki" / "crabcan".

## Course materials (primary sources)

### Assignment page [1]

Fetched 2026-10-07 as HTML (21,458 bytes). Key verbatim passages:

- Goal: "create a simple container launcher tool by ourselves", to "gain a deep understanding of process abstraction and isolation … and … develop system programming skills."
- Language: "create a container runtime tool from scratch in C or C++ or a language of your choice that launches a Linux application container and is able to run users' Linux applications in the container."
- "the usage of the tool mirrors the popular container management tool `Docker`; however, in this project, we only implement a small subset of it."
- "Multiple containers on a host share the same underlying operating system kernel. First and foremost, the tool must be a container management tool."
- Examples: `sudo bcdocker run tinysys /bin/bash` → `bash-5.0#`; `sudo bccontainer/bcdocker run tinysys /bin/ls -l -t -r` shows only `usr lib bin->/usr/bin etc proc`; `sudo bcdocker run bctinysys /bin/ls` → `bin etc lib proc usr`.
- "Process IDs start from 1 in the container." Example `ps axf` output: PID 1 is `bccontainer/bcdocker run bctinysys /bin/ps axf`, PID 14 is `/bin/ps axf`. In the interactive example, PID 1 is `bcdocker run bctinysys /bin/bash`, PID 14 is `/bin/bash`, PID 15 is `\_ ps axf`.
- "we will not automate the process; rather, we shall manually create application containers. Generally, follow the steps: … familiarize ourselves with Linux directory structures. Kyle Rankin has a short article about the File System Hierarchy Standard (missing reference). The report should minimally include the following items:" The page is **truncated here**: the raw HTML closes the `<ol>` mid-sentence and jumps to the report bullet list. The step list for building the tiny Linux system and the heading of the report section are missing from the published page (a source defect, confirmed in the raw HTML at line 247–252).
- Report: "Use either the ACM conference or IEEE conference proceedings template", "Cite references properly", "Describe the design of the container tool", "Describe the process of creating a Linux container for an application", "Discuss the lessons learned."
- Oral presentation: "deliver a 10-minute oral slides presentation … 7 minutes for the presentation and 3 minutes for questions". Submission section also says "10 minutes, ideally with slides, a demo of the features of the program, and the discussion about the questions in this assignment."
- Repository: "The top directory of the repository should contain a README file"; "Add a `.gitignore`"; "`README.md`. The top-level README file is for student information"; "Directory `src`. Source code goes here."; "Directory `doc`. This is where the presentation slides go."
- Commits: "Do not submit the solution as a single commit. Commit each feature completed as a single commit." AI: "For every commit that contains AI-generated or AI-assisted content, include a `Co-authored-by` trailer … A single 'initial commit' containing the entire final script will be treated as incomplete regardless of disclosure."
- Optional: `--memory=512m` ("requires cgroups (the `memory` controller)"), `--pids-limit=20` ("requires cgroups (the `pids` controller)"), networking ("requires creating a network namespace, a virtual Ethernet pair, and configuring NAT on the host").

### Lecture "Process Abstraction and Isolation in Linux" (Sep 30, 2026) [2]

Linked from the schedule week that assigns Project 2. This is the most specific statement of the minimum:

> "In the project assignment, you are asked to build a minimal container launcher:
> ▶ Use clone() to create a child in at least two new namespaces (e.g., PID and UTS).
> ▶ Demonstrate that the child sees a different view from the parent: ▶ the child is PID 1 in its own PID namespace; ▶ the child can set its own hostname without affecting the parent; ▶ (optional) the child sees its own /proc.
> ▶ Explain, in writing, what each flag does and what would happen without it.
> Not required for the minimum: image pulling, overlay filesystems, networking, resource limits."

And: "chroot() or pivot_root() gives the child its own filesystem root. Without a separate root, the containerized process would see the host's / and could access files outside the container." "Mental model: a container is not a virtual machine. It is a process (or group of processes) whose kernel-provided view of the system has been narrowed."

Namespace table on slide 6: PID/CLONE_NEWPID, Mount/CLONE_NEWNS, Network/CLONE_NEWNET, UTS/CLONE_NEWUTS, IPC/CLONE_NEWIPC, User/CLONE_NEWUSER.

### Tutorial video "A Tutorial for BC Docker Project" [3]

110 min (6,587 s), 1920×1080, recorded in a prior term (last-modified 2023-03-30). Not transcribed; frames sampled every 5 min with ffmpeg. Saved frames in `video-frames/`:

- 57m00s: `clone(run_setup_container, …, CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, NULL)`, then `waitpid(pid, NULL, 0)`. `main` dispatches on `argv[1] == "run"` and requires `argc >= 4`.
- 1h17m: child does `sethostname(BC_CONTAINER_HOSTNAME)`, `chroot("/home/brooklyn/tinysys")`, `chdir("/")`, `mount("proc", "proc", "proc", 0, NULL)`, then `run_app("/bin/bash")`.
- 1h32m: rootfs `cisc7310sys` built by hand: `mkdir cisc7310sys/proc`, copy `/usr/bin/dash`, then `ldd /usr/bin/dash` and `cp /lib/i386-linux-gnu/libc.so.6 …`. Host is Debian 10, i386, kernel 4.19.0-14-686.
- 1h47m: final form `sudo ./bcdocker run ./tinysys /bin/bash` (container argument is a path, `chroot(argv[2])`), prints `child pid = 1`, `hostname = bcdocker`; inside, `ps` shows `1 bcdocker`, `2 bash`, `3 ps`. The launcher's cloned child is PID 1 and forks the app, which is the shape in the assignment's sample output.

### Course logistics [4], [5]

- Assignments page: "Project 2. BC Docker: Building an Application Container Launcher. assigned: [October 7, 2026] and due: [October 14, 2026]". "All future dates are placeholder only and subject to change."
- Syllabus: "Late submissions are accepted, but penalized with 10% of penalty or one letter grade lower each day late … a student will receive 0 on a submission of 5 or more days late." Grade weight: "Projects, Presentations, and Research Papers 40%". Generative AI: "students shall disclose the way the generative AI is used for each assignment."

## Kernel and platform references

- pid_namespaces(7) [6]: "The first process created in a new namespace (i.e., the process created using clone(2) with the CLONE_NEWPID flag, or the first child created by a process after a call to unshare(2) using the CLONE_NEWPID flag) has the PID 1, and is the 'init' process for the namespace". "If the 'init' process of a PID namespace terminates, the kernel terminates all of the processes in the namespace via a SIGKILL signal." unshare(CLONE_NEWPID) does "not … change the PID namespace of the calling process" (only children). "After creating a new PID namespace, it is useful for the child to change its root directory and mount a new procfs instance at /proc so that tools such as ps(1) work correctly."
- namespaces(7) [7]: the catalog of namespace types (cgroup, IPC, network, mount, PID, time, user, UTS).
- chroot(2), Linux [8]: "Only a privileged process (Linux: one with the CAP_SYS_CHROOT capability in its user namespace) may call chroot()." "This call does not change the current working directory". "it is not intended to be used for any kind of security purpose, neither to fully sandbox a process nor to restrict filesystem system calls."
- pivot_root(2) [9]: the alternative the lecture names; needs a mount namespace and a mount point as new root.
- chroot(2), macOS [10]: present in Darwin; "causes dirname to become the root directory". macOS has no PID, UTS or mount namespaces (no `clone(2)` or `unshare(2)` in Darwin).
- macOS Big Sur+ removed on-disk copies of system dylibs into the dyld shared cache [11], so the "copy ldd-resolved libraries into the jail" technique does not work on macOS; and Apple does not support statically linked binaries on macOS [12]. A Darwin chroot jail is therefore hard to populate, and it can never run Linux binaries.
- Docker seccomp default profile [13]: `clone` "Deny cloning new namespaces. Also gated by CAP_SYS_ADMIN for CLONE_* flags, except CLONE_NEWUSER"; `unshare` "Deny cloning new namespaces for processes. Also gated by CAP_SYS_ADMIN"; `mount` "Deny mounting, already gated by CAP_SYS_ADMIN"; `pivot_root` "Deny pivot_root, should be privileged operation". The profile re-allows the namespace syscalls when the container holds CAP_SYS_ADMIN, so `--cap-add SYS_ADMIN` is the minimal opening and `--privileged` (all caps, no seccomp, no masked /proc paths) is the simple baseline. Mounting a fresh procfs can still fail with EPERM in hardened setups because Docker masks /proc entries and the kernel refuses a more-revealing proc mount in non-initial user namespaces [14]; treat `--privileged` as known-good and verify the minimal flags empirically.

## Prior art

- Liz Rice, "Containers From Scratch" (Go): clone with CLONE_NEWUTS|NEWPID|NEWNS, chroot, mount proc, re-exec self as child [15].
- Litchi Pi, "Writing a container in Rust" (crabcan): 8-part series using `nix` for clone, namespaces, user namespaces/capabilities, seccomp, exec [16].
- penumbra23, "Container runtime in Rust" series on DEV [17].
- youki: production OCI runtime in Rust; far beyond scope, useful as a reference for nix usage [18].
- G. Sharma, "Write your own container, for fun and no profit!", Code Mesh LDN 2019 [19].

## Rootfs construction options

| Option | Matches assignment wording | Notes |
|---|---|---|
| Hand-built: mkdir FHS skeleton, copy binaries, copy `ldd`-resolved libs and the dynamic loader | Yes. The tutorial does exactly this [3]; the page says "manually create application containers" [1] | Must match the host arch (arm64 in Docker on Apple Silicon, amd64 or arm64 on Debian). `ps` needs procps plus its libs (libprocps/libproc2, libsystemd on Debian) and a mounted /proc. bash needs libtinfo. |
| BusyBox static | Partly. Manual, tiny, one binary with applets | Gives `sh`, not `bash-5.x`; output differs from the samples. Good second container. |
| `docker export` of `debian:bookworm-slim` / `busybox` / `alpine` | Weak. Arguably the automation the page says not to use | Fast and complete; useful as a reference or a third container. |
| `debootstrap` | Weak. Automated; large (~200+ MB) | Debian-host only. |

Minimum contents implied by the samples: `bin` (or `bin -> usr/bin`), `usr/bin`, `lib` (+ `lib64` / `ld-linux-*.so` per arch), `etc` (the sample has it; `passwd` and `group` let `ls -l` and `ps` print names, otherwise numeric IDs as in the sample `1000 1000`), and an empty `proc` mount point. `/dev` is absent from the samples; bash and ps run without it, though bash prints job-control warnings without a tty (seen in the video: "Cannot set tty process group").

## Sources

[1] H. Chen, "Project 2: Application Container," CISC 7310X Operating Systems I, CUNY Brooklyn College, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignment/bccontainer (accessed Oct. 7, 2026).

[2] H. Chen, "Process Abstraction and Isolation in Linux," lecture slides, CISC 7310X, Sep. 30, 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/lecture/processisolation.pdf

[3] H. Chen, "A Tutorial for BC Docker Project (OS Application Container)," video, 2023. [Online]. Available: http://www.sci.brooklyn.cuny.edu/~chen/uploads/course/CISC7310X/video/bcdocker.html

[4] H. Chen, "Assignments," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/assignments/

[5] H. Chen, "Syllabus," CISC 7310X, Fall 2026. [Online]. Available: https://huichen-cs.github.io/course/CISC7310X/26FA/syllabus/

[6] M. Kerrisk, "pid_namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html

[7] M. Kerrisk, "namespaces(7)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man7/namespaces.7.html

[8] "chroot(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/chroot.2.html

[9] "pivot_root(2)," Linux man-pages. [Online]. Available: https://man7.org/linux/man-pages/man2/pivot_root.2.html

[10] Apple, "chroot(2)," macOS System Calls Manual. [Online]. Available: https://keith.github.io/xcode-man-pages/chroot.2.html

[11] Apple Developer Forums, "macOS Big Sur … dynamic linker cache," thread 667340. [Online]. Available: https://developer.apple.com/forums/thread/667340

[12] Apple, "Technical Q&A QA1118: Statically linked binaries on Mac OS X." [Online]. Available: https://developer.apple.com/library/archive/qa/qa1118/_index.html

[13] Docker, "Seccomp security profiles for Docker." [Online]. Available: https://docs.docker.com/engine/security/seccomp/

[14] E. W. Biederman et al., "Re: [PATCH] [RFC][WIP] namespace.c: Allow some unprivileged proc mounts when not fully visible," LKML, Apr. 2018. [Online]. Available: https://lkml.iu.edu/hypermail/linux/kernel/1804.0/02206.html

[15] L. Rice, "containers-from-scratch," GitHub. [Online]. Available: https://github.com/lizrice/containers-from-scratch

[16] Litchi Pi, "Writing a container in Rust," blog series. [Online]. Available: https://litchipi.github.io/series/container_in_rust

[17] penumbra23, "Container runtime in Rust – Part 0," DEV Community. [Online]. Available: https://dev.to/penumbra23/container-runtime-in-rust-part-0-1ecm

[18] youki-dev, "youki: A container runtime written in Rust," GitHub. [Online]. Available: https://github.com/youki-dev/youki

[19] G. Sharma, "Write your own container for fun and no profit," Code Mesh LDN 2019. [Online]. Available: https://codesync.global/media/write-your-own-container-for-fun-and-no-profit-cmldn19/
