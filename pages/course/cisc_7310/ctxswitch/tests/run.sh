#!/usr/bin/env bash
# Feature test for ctxswitch: builds the image, runs every ported program and switchbench in
# resource limited debian:stable-slim containers, and asserts what the evidence must show.
#
#     tests/run.sh [--results-dir <dir>]
#
# Needs only Docker on the host. Takes a few minutes (one image build, about a minute of runs).

set -u

project=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
results=$project/results/$stamp
[[ ${1:-} == --results-dir ]] && results=$2
image=ctxswitch:test
failures=0

# Explicit resources for every container (README of the experiment depends on these values).
limits=(--cpus=1 --cpuset-cpus=0 --memory=256m --memory-swap=256m --pids-limit=64)

fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
note() { echo "--- $*"; }
need() { [[ $2 -ge $3 ]] || fail "$1: expected >= $3, got $2"; }
atmost() { [[ $2 -le $3 ]] || fail "$1: expected <= $3, got $2"; }

mkdir -p "$results/programs" "$results/strace" "$results/proc"

# run <name> <extra docker args...> -- <command...>: create, record inspect, start, remove.
run() {
  local name=$1; shift
  local extra=()
  while [[ $1 != -- ]]; do extra+=("$1"); shift; done
  shift
  docker rm -f "ctxswitch-$name" >/dev/null 2>&1
  docker create --name "ctxswitch-$name" "${limits[@]}" ${extra[@]+"${extra[@]}"} "$image" "$@" >/dev/null || return 1
  docker inspect "ctxswitch-$name" >"$results/programs/$name.inspect.json"
  docker start -a "ctxswitch-$name"
  local rc=$?
  docker rm -f "ctxswitch-$name" >/dev/null 2>&1
  return $rc
}

note "build"
docker build -t "$image" "$project" >"$results/build.log" 2>&1 || { tail -20 "$results/build.log"; fail "docker build"; exit 1; }

note "explicit resources are applied"
run limits -- cat /proc/self/cgroup >/dev/null 2>&1
python3 - "$results/programs/limits.inspect.json" <<'PY' || fail "docker inspect does not show the requested limits"
import json, sys
h = json.load(open(sys.argv[1]))[0]["HostConfig"]
assert h["NanoCpus"] == 1_000_000_000, h["NanoCpus"]
assert h["CpusetCpus"] == "0", h["CpusetCpus"]
assert h["Memory"] == 256 * 1024 * 1024, h["Memory"]
assert h["MemorySwap"] == 256 * 1024 * 1024, h["MemorySwap"]
assert h["PidsLimit"] == 64, h["PidsLimit"]
PY

note "umcontext and umthread ports"
out=$(run uctxswitch -- uctxswitch 2>&1); echo "$out" >"$results/programs/uctxswitch.txt"
[[ $(grep -c 'User mode context obtained!' <<<"$out") -eq 2 ]] || fail "uctxswitch: context should be obtained twice"
grep -q 'Saved context by calling getcontext' <<<"$out" || fail "uctxswitch: missing saved message"
grep -q 'Context restored by calling setcontext' <<<"$out" || fail "uctxswitch: missing restored message"

out=$(run uctxmake -- uctxmake 2>&1); rc=$?; echo "$out" >"$results/programs/uctxmake.txt"
[[ $rc -eq 0 ]] || fail "uctxmake exit status $rc"
grep -q 'hello_user is at' <<<"$out" || fail "uctxmake: missing address line"
grep -q 'From hello_user: Hello, User!' <<<"$out" || fail "uctxmake: hello_user did not run"
[[ $(grep -c 'The (incomplete) user context:' <<<"$out") -eq 2 ]] || fail "uctxmake: expected two register dumps"

out=$(run uctxswap -- uctxswap 2>&1); rc=$?; echo "$out" >"$results/programs/uctxswap.txt"
[[ $rc -eq 0 ]] || fail "uctxswap exit status $rc"
expected=$'main: swapcontext(&uctx_main, &uctx_func2)\nfunc2: started\nfunc2: swapcontext(&uctx_func2, &uctx_func1)\nfunc1: started\nfunc1: swapcontext(&uctx_func1, &uctx_func2)\nfunc2: returning\nfunc1: returning\nmain: exiting'
[[ $(grep -E '^(func|main:)' <<<"$out") == "$expected" ]] || fail "uctxswap: call order differs from the C original"

out=$(run uctxrestore -- timeout 3.5 uctxrestore 2>&1); echo "$out" >"$results/programs/uctxrestore.txt"
need "uctxrestore getcontext lines in 3.5s" "$(grep -c 'After getcontext: Hello, World!' <<<"$out")" 3
grep -q 'After setcontext' <<<"$out" && fail "uctxrestore: reached code after setcontext"

out=$(run umthreaddemo -- umthreaddemo 2>&1); rc=$?; echo "$out" >"$results/programs/umthreaddemo.txt"
[[ $rc -eq 0 ]] || fail "umthreaddemo exit status $rc"
[[ $(grep -c 'Hello, User!' <<<"$out") -eq 20 ]] || fail "umthreaddemo: expected 20 user lines"
[[ $(grep -c 'Hello, World!' <<<"$out") -eq 10 ]] || fail "umthreaddemo: expected 10 world lines"
grep -q 'The hello world thread has exited.' <<<"$out" || fail "umthreaddemo: world thread exit not reported"
grep -q 'The hello user thread has exited.' <<<"$out" || fail "umthreaddemo: user thread exit not reported"

note "switchbench"
run bench -- switchbench --switches 200000 --reps 5 --working-sets 0,32768,262144 >"$results/bench.csv" 2>"$results/bench.err" \
  || { cat "$results/bench.err"; fail "switchbench failed"; }
python3 - "$results/bench.csv" <<'PY' || failures=$((failures + 1))
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1])))
by = {(r["mechanism"], int(r["working_set_bytes"])): r for r in rows}
bad = []
for m in ("thread", "process", "ucontext", "regswitch", "green"):
    for ws in (0, 32768, 262144):
        if (m, ws) not in by: bad.append(f"missing row {m} {ws}")
for m in ("baseline-socket", "baseline-sigprocmask"):
    if (m, 0) not in by: bad.append(f"missing baseline {m}")
if not bad:
    f = lambda r, k: float(r[k])
    handoffs = lambda r: f(r, "switches_per_rep") * f(r, "reps")
    for m in ("thread", "process"):
        for ws in (0, 32768, 262144):
            r = by[m, ws]
            if f(r, "nvcsw") < 0.5 * handoffs(r): bad.append(f"{m} {ws}: kernel saw too few voluntary switches")
    for m in ("ucontext", "regswitch", "green"):
        for ws in (0, 32768, 262144):
            r = by[m, ws]
            if f(r, "nvcsw") + f(r, "nivcsw") > 0.01 * handoffs(r): bad.append(f"{m} {ws}: kernel saw switches it should not")
    ns = lambda m: f(by[m, 0], "ns_per_switch")
    for m in ("thread", "process"):
        if not ns(m) > f(by["baseline-socket", 0], "ns_per_switch"): bad.append(f"{m} is not above its socket baseline")
    if f(by["baseline-socket", 0], "nvcsw") + f(by["baseline-socket", 0], "nivcsw") > 0.01 * handoffs(by["baseline-socket", 0]):
        bad.append("baseline-socket saw task switches; it is supposed to be switch free")
    if not ns("green") < ns("ucontext"): bad.append("green is not cheaper than ucontext")
    if not ns("regswitch") < ns("ucontext") < ns("thread"):
        bad.append("cost ordering at ws=0 is not regswitch < ucontext < thread: "
                   + ", ".join(f"{m}={ns(m):.0f}" for m in ("regswitch", "ucontext", "thread", "process")))
for b in bad: print("FAIL:", b, file=sys.stderr)
sys.exit(1 if bad else 0)
PY

note "syscalls issued, per mechanism"
for m in thread process ucontext regswitch green; do
  run "strace-$m" --cap-add=SYS_PTRACE -- strace -c -f -o /dev/stderr switchbench --mechanisms "$m" --switches 20000 --reps 1 --working-sets 0 --strace-friendly >/dev/null 2>"$results/strace/$m.txt"
done
sigcalls() { awk '$NF=="rt_sigprocmask"{print $4}' "$results/strace/$1.txt" 2>/dev/null | head -1; }
need "ucontext rt_sigprocmask calls (>= 90% of 20000 handoffs)" "$(sigcalls ucontext || echo 0)" 18000
atmost "regswitch rt_sigprocmask calls" "$(sigcalls regswitch || echo 0)" 100
atmost "green rt_sigprocmask calls" "$(sigcalls green || echo 0)" 100

note "kernel view snapshots"
# --proc-snapshot makes switchbench re-execute itself as a separate observer process that dumps
# /proc/<pid>/task/*/{stat,status,syscall,wchan,stack} of the benchmark mid-run, as "== path ==" blocks.
for m in thread ucontext green; do
  run "proc-$m" -- switchbench --mechanisms "$m" --switches 2000000 --reps 1 --working-sets 0 --proc-snapshot >"$results/proc/$m.txt" 2>/dev/null
done
[[ $(grep -c '^== /proc/[0-9]*/task/[0-9]*/status ==$' "$results/proc/thread.txt") -ge 2 ]] || fail "proc snapshot: expected status for at least two tasks under thread"
for m in ucontext green; do
  [[ $(grep -c '^== /proc/[0-9]*/task/[0-9]*/status ==$' "$results/proc/$m.txt") -eq 1 ]] || fail "proc snapshot: $m should show exactly one task"
done
grep -q '^== /proc/[0-9]*/task/[0-9]*/syscall ==$' "$results/proc/thread.txt" || fail "proc snapshot: no syscall file captured for thread"
grep -A1 '/syscall ==$' "$results/proc/thread.txt" | grep -Eq '^(running|[0-9-]+ )' || fail "proc snapshot: syscall file of a blocked thread was empty"

note "unsafe audit"
[[ -f "$project/SAFETY.md" ]] || fail "SAFETY.md (audit against unsafe_rust_review) missing"
grep -q '^Open rejections: 0$' "$project/SAFETY.md" 2>/dev/null || fail "SAFETY.md must state 'Open rejections: 0'"
grep -qi 'dzania' "$project/README.md" "$project/REVIEW.md" 2>/dev/null || fail "attribution to Dzania missing from README.md or REVIEW.md"

note "REVIEW.md"
[[ -f "$project/REVIEW.md" ]] || fail "REVIEW.md missing"
for q in 'What state is saved and restored' 'What does the kernel see' 'Why is the user-level switch cheaper' 'Why a Thread Switch Is Cheaper'; do
  grep -q "$q" "$project/REVIEW.md" 2>/dev/null || fail "REVIEW.md lacks section: $q"
done
[[ $(grep -c '^\*\*For you to answer:\*\*' "$project/REVIEW.md" 2>/dev/null) -eq 4 ]] || fail "REVIEW.md needs four 'For you to answer' placeholders"

echo "results: $results"
if [[ $failures -ne 0 ]]; then echo "$failures check(s) failed" >&2; exit 1; fi
echo "ok"
