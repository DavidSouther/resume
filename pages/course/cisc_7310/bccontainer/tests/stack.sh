#!/usr/bin/env bash
# Stack depth check for bcdocker's cloned child (assumption A1 in src/clone.rs).
#
# The child runs on a heap stack with no guard page, so its safety rests on the child using far
# less than stack::MIN (1 MiB). This measures how much of that stack the child uses, for the
# whole setup path, by reading PID 1's stack pointer and pagemap from the host while it waits
# for the application.
# It fails above MIN / 16 = 64 KiB, so growth shows up here long before it nears the floor.
# Run it on every platform bcdocker targets:
#
#     cargo build && sudo tests/stack.sh
#
# BCDOCKER overrides the binary under test. The default is the debug build, which uses more
# stack; set BCDOCKER to check the release build as well.

set -u

project=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
bcdocker=${BCDOCKER:-$project/target/debug/bcdocker}
work=$project/target/test-work
limit_kb=${LIMIT_KB:-64}   # stack::MIN / 16; LIMIT_KB lowers it to check the check fails
failures=0

fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }

[[ $(id -u) == 0 ]] || { echo "bcdocker needs root: sudo tests/stack.sh" >&2; exit 1; }
[[ -x $bcdocker ]] || { echo "no binary at $bcdocker: run cargo build first" >&2; exit 1; }
mkdir -p "$work"
if [[ ! -d $work/containers/bctest ]]; then
  (cd "$work" && "$project/scripts/mkrootfs.sh" bctest) || { echo "mkrootfs.sh bctest failed" >&2; exit 1; }
fi

# child_of <pid>: a process whose parent is <pid>, read from /proc alone (no procps).
child_of() {
  local f line
  for f in /proc/[0-9]*/status; do
    while IFS= read -r line; do
      [[ $line == PPid:* ]] || continue
      [[ ${line#PPid:} =~ ^[[:space:]]*$1$ ]] && { f=${f#/proc/}; echo "${f%/status}"; return; }
      break
    done 2>/dev/null <"$f"
  done
}

# touched <stack bytes> [application arguments...]: the kilobytes of the child's stack in use,
# while PID 1 waits for the application, then "heap" if the stack pointer lies in the brk heap,
# where an overflow would run into live allocations, or "own" otherwise. PID 1 is blocked in a system call, so
# /proc/<pid>/syscall gives its stack pointer. The stack is a zeroed heap block, so pages the
# child never wrote are not privately mapped. Counting the contiguous run of exclusive, present
# pages (pagemap bits 63 and 56) downward from the stack pointer gives the depth the child
# reached. One page is added for the frames above the pointer, assuming the frames above the
# waiting `waitpid` fit in one page. This does not depend on where the kernel merged the block
# with a neighbouring mapping.
touched() {
  local bytes=$1; shift
  local host pid1='' app='' sleeper='' sp page first count=0 i e range path where=own
  (cd "$work" && exec "$bcdocker" run --stack-size "$bytes" bctest /bin/sh -c 'sleep 20' sh "$@" \
    </dev/null >/dev/null 2>&1) &
  host=$!
  # Found by ancestry (bcdocker, PID 1, sh, sleep), never by name. Once sh has started sleep,
  # PID 1 is waiting.
  for _ in $(seq 100); do
    pid1=$(child_of "$host")
    [[ -n $pid1 ]] && app=$(child_of "$pid1")
    [[ -n $app ]] && sleeper=$(child_of "$app")
    [[ -n $sleeper ]] && break
    sleep 0.1
  done
  sp=$(awk '{print $(NF-1)}' "/proc/$pid1/syscall" 2>/dev/null)
  if [[ $sp == 0x* ]]; then
    page=$((sp / 4096)); first=$((page - 255))
    mapfile -t entries < <(dd if="/proc/$pid1/pagemap" bs=8 skip="$first" count=256 2>/dev/null |
      od -An -v -tx8 -w8)
    for ((i = 255; i >= 0; i--)); do
      e=$((0x${entries[i]// /}))
      (((e >> 63) & 1 && (e >> 56) & 1)) || break
      count=$((count + 1))
    done
    while read -r range _ _ _ _ path; do
      [[ $path == '[heap]' ]] && ((sp >= 16#${range%-*} && sp < 16#${range#*-})) && where=heap
    done <"/proc/$pid1/maps"
  fi
  # PID 1's parent-death signal ends the container with the host process.
  kill -9 "$host" 2>/dev/null
  { wait "$host"; } 2>/dev/null
  [[ $sp == 0x* ]] && echo "$(((count + 1) * 4)) $where"
}

check_touched() { # check_touched <label> <stack bytes> [application arguments...]
  local label=$1 bytes=$2 kb where; shift 2
  read -r kb where < <(touched "$bytes" "$@")
  if [[ -z $kb ]]; then fail "$label: could not read the child stack pointer"; return; fi
  echo "$label: $kb KiB used of $((bytes / 1024)) KiB (limit $limit_kb)"
  ((kb <= limit_kb)) || fail "$label: used $kb KiB, over $limit_kb"
  [[ $where == own ]] || fail "$label: the stack lies in the brk heap, next to live allocations"
}

big_args=(); for i in $(seq 2000); do big_args+=("argument-number-$i-$(printf 'x%.0s' $(seq 80))"); done
big_env=$(printf 'e%.0s' $(seq 100000))

check_touched "default stack (8M)" $((8 << 20))
check_touched "floor stack (1M)" $((1 << 20))
BIG=$big_env check_touched "floor stack, 2000 arguments and a 100 KB environment" $((1 << 20)) "${big_args[@]}"

# The failing-exec path formats a long path into an error message, on a floor-sized stack.
long=/$(printf 'a%.0s' $(seq 3000))
err=$(cd "$work" && "$bcdocker" run --stack-size 1M bctest "$long" 2>&1 >/dev/null </dev/null); code=$?
[[ $code -eq 1 ]] || fail "failing exec with a long path exited $code, not 1"
[[ $err == "bcdocker: exec $long: "* ]] || fail "failing exec message: ${err:0:80}"

# An application named without a / is found on PATH by glibc's execvp in a fork of PID 1,
# running on a copy of PID 1's stack. A file without #! makes execvp retry through /bin/sh with
# a copy of the argument array on that stack, which grows with the argument count. Run it at
# the floor with the most arguments the command line accepts, and check one more is refused.
max_args=16384   # cli::MAX_ARGS
noexec=$work/containers/bctest/usr/local/bin/bcdocker-noexec
trap 'rm -f "$noexec"' EXIT
printf 'echo ok\n' >"$noexec" && chmod 755 "$noexec"
empties=(); for ((i = 0; i < max_args; i++)); do empties+=(''); done
out=$(cd "$work" && "$bcdocker" run --stack-size 1M bctest bcdocker-noexec "${empties[@]}" 2>&1 </dev/null); code=$?
[[ $code -eq 0 && $out == ok ]] || fail "script fallback with $max_args arguments exited $code: ${out:0:80}"
err=$(cd "$work" && "$bcdocker" run --stack-size 1M bctest bcdocker-noexec "${empties[@]}" '' 2>&1 >/dev/null </dev/null); code=$?
[[ $code -eq 1 && $err == "bcdocker: usage: "*"$max_args"* ]] || fail "$((max_args + 1)) arguments exited $code: ${err:0:80}"
rm -f "$noexec"

# A stack the address-space limit cannot hold is refused with a message, not an abort.
err=$(cd "$work" && ulimit -v 400000 && "$bcdocker" run --stack-size 1G bctest /bin/true 2>&1 >/dev/null </dev/null); code=$?
[[ $code -eq 1 ]] || fail "unallocatable stack exited $code, not 1"
[[ $err == "bcdocker: stack size: cannot allocate 1G" ]] || fail "unallocatable stack message: ${err:0:80}"

if ((failures)); then echo "$failures check(s) failed" >&2; exit 1; fi
echo "ok"
