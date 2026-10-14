# Intent review — research.md (Research-phase blind-spot variant)

*Anchor: research.md "Topic and Intent" verbatim quote (no `.ailly/prompts/` file supplied).*
*Dispatch note: this harness offered the research phase runner no subagent-dispatch tool, so this review was run in-session and is not the cold, memory-less reviewer that `intent-review.md` specifies. Re-run it cold before the design gate if the human wants that guarantee.*

Candidates already settled by research.md's Resolved Decisions or open questions were dropped: chroot vs. namespace, PID shape, macOS role, Docker flags, rootfs method, optional tasks, repo mapping.

---

### 2026-10-07 — IR-1 — Research gap (blind spot): "the questions in this assignment"

Inside the frame we have now built, what would we no longer notice is missing? The submission section asks the demo to include "the discussion about the questions in this assignment" [assignment page]. Our research oriented around functional requirements and treats the lecture's "explain what each flag does" as the only written question. The published page contains no explicit question list; it may have been lost in the same truncation that removed the "Creating a Tiny Linux System" steps. Orienting on the code has made the content of the presentation discussion invisible. Should design plan for a set of discussion questions (and ask the instructor what they are)?

**Status:** resolved, closed 2026-10-07 (human decided or dismissed; see research.md Resolved Decisions)

### 2026-10-07 — IR-2 — Research gap (blind spot): host architecture mix

The original request names Debian native and Docker-on-Mac as targets. Our research notes that the rootfs must match the architecture, but it assumes one rootfs per host and never asks what the Debian machine's architecture is. If Debian is amd64 and the Mac is Apple Silicon (arm64), the hand-built `ldd`-copied rootfs cannot be shared between the two demo environments and must be built on each (or per architecture). Is the Debian host amd64 or arm64, and should the rootfs build be a re-runnable per-host step rather than a committed artifact?

**Status:** resolved, closed 2026-10-07 (human decided or dismissed; see research.md Resolved Decisions)

### 2026-10-07 — IR-3 — Research gap (blind spot): "begin" and the first commit

The request opens with "begin". Our research is scoped to requirements and creates no code, but the assignment penalizes a single bulk commit and wants "each feature completed as a single commit" with AI trailers. Orienting on requirements gathering has hidden that the repository's commit history *starts now*, and that the rubric grades it. Should the first design/plan step set up the classroom repo and an initial README/.gitignore commit before any feature work?

**Status:** resolved, closed 2026-10-07 (human decided or dismissed; see research.md Resolved Decisions)
