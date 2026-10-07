#!/usr/bin/env bash
# Feature test for bcdocker: the primary user story, end to end.
#
# A student builds a container root from debian:bookworm-slim, runs commands in
# it as root, and sees their own PID tree, hostname, and filesystem, with the
# command's exit status coming back to the host shell.
#
# Run on a Linux host with Docker or crane:
#
#     cargo build && sudo tests/run.sh
#
# BCDOCKER overrides the binary under test.

set -u

project=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
bcdocker=${BCDOCKER:-$project/target/debug/bcdocker}
work=$project/target/test-work
failures=0

fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
check() { [[ "$2" == "$3" ]] || fail "$1: expected '$2', got '$3'"; }
hostname_now() { cat /proc/sys/kernel/hostname; }
# run <container> <app> [args...]: bcdocker from the scratch working directory.
run() { (cd "$work" && "$bcdocker" run "$@" </dev/null); }

[[ $(id -u) == 0 ]] || { echo "bcdocker needs root: sudo tests/run.sh" >&2; exit 1; }
[[ -x $bcdocker ]] || { echo "no binary at $bcdocker: run cargo build first" >&2; exit 1; }

# 1. Build a container root from bookworm-slim, in a scratch working directory.
mkdir -p "$work"
if [[ ! -d $work/containers/bctest ]]; then
  (cd "$work" && "$project/scripts/mkrootfs.sh" bctest) || { echo "mkrootfs.sh bctest failed" >&2; exit 1; }
fi
rootfs=$work/containers/bctest
host_name=$(hostname_now)

# 2. Run a shell in it and look around.
probe='echo pid=$$
echo host=$(cat /proc/sys/kernel/hostname)
echo init=$(cat /proc/1/comm)
for p in /proc/[0-9]*; do echo seen=${p#/proc/}; done
echo root=$(ls /)
if [ -e "$HOSTWORK" ]; then echo hostfs=leaked; else echo hostfs=sealed; fi'
out=$(HOSTWORK=$work run bctest /bin/sh -c "$probe" 2>"$work/stderr")
check "probe exit status" 0 $?
[[ -s $work/stderr ]] && fail "probe wrote to stderr: $(cat "$work/stderr")"
field() { sed -n "s/^$1=//p" <<<"$out"; }

# The launcher is PID 1 and the application is its child.
check "application PID" 2 "$(field pid)"
check "PID 1 command" bcdocker "$(field init)"
# Only the container's own processes are visible.
check "visible PIDs" 1,2 "$(field seen | paste -sd, -)"
# The container has its own hostname, and the host's is untouched.
check "container hostname" bctest "$(field host)"
check "host hostname" "$host_name" "$(hostname_now)"
# The filesystem is the bookworm-slim root, sealed from the host.
for dir in bin etc usr proc; do
  [[ " $(field root) " == *" $dir "* ]] || fail "$dir missing from container root: $(field root)"
done
check "host filesystem" sealed "$(field hostfs)"
# Nothing the container mounted is left on the host.
grep -q "$rootfs" /proc/mounts && fail "leftover mount under $rootfs"
# Nothing the container mounts reaches the mount table it was started from, even when that
# table propagates mounts: run in a throwaway namespace whose / is shared, and look there.
leaked=$(cd "$work" && unshare --mount --propagation shared \
  bash -c '"$1" run bctest /bin/true </dev/null; grep -c -- "$2" /proc/self/mountinfo' _ "$bcdocker" "$rootfs")
check "mounts leaked to a shared parent" 0 "$leaked"
# Setup left the rootfs's /proc an empty directory.
[[ -z $(ls -A "$rootfs/proc") ]] || fail "rootfs /proc is not an empty directory"

# 3. Exit status and failures reach the host shell, each with a named reason.
run bctest /bin/sh -c 'exit 7'; check "exit 7" 7 $?
run bctest /bin/sh -c 'kill -9 $$'; check "killed by SIGKILL" 137 $?

err=$(run bctest /nonexistent 2>&1 >/dev/null); code=$?
[[ $code -ne 0 ]] || fail "missing application exited 0"
[[ $err == *"/nonexistent"* ]] || fail "missing application error does not name it: $err"

err=$(run bctest /etc/passwd 2>&1 >/dev/null); code=$?
[[ $code -ne 0 ]] || fail "non-executable application exited 0"
[[ $err == *"/etc/passwd"* ]] || fail "non-executable application error does not name it: $err"

err=$(run no-such-container /bin/true 2>&1 >/dev/null); code=$?
[[ $code -ne 0 ]] || fail "missing container exited 0"
[[ $err == *"no-such-container"* ]] || fail "missing container error does not name it: $err"

if ((failures)); then echo "$failures check(s) failed" >&2; exit 1; fi
echo "ok"
