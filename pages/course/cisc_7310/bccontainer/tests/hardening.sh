#!/usr/bin/env bash
# Isolation checks beyond run.sh: /dev, descriptors, PATH, orphan reaping, and parent death.
# Run on a Linux host with Docker or crane, after `cargo build`:
#
#     sudo tests/hardening.sh
#
# Shares target/test-work with run.sh and builds its container if it is absent.

set -u

project=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
bcdocker=${BCDOCKER:-$project/target/debug/bcdocker}
work=$project/target/test-work
debian_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
failures=0

fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
check() { [[ "$2" == "$3" ]] || fail "$1: expected '$2', got '$3'"; }
# run <container> <app> [args...]: bcdocker from the scratch working directory.
run() { (cd "$work" && "$bcdocker" run "$@" </dev/null); }

[[ $(id -u) == 0 ]] || { echo "bcdocker needs root: sudo tests/hardening.sh" >&2; exit 1; }
[[ -x $bcdocker ]] || { echo "no binary at $bcdocker: run cargo build first" >&2; exit 1; }
mkdir -p "$work"
if [[ ! -d $work/containers/bctest ]]; then
  (cd "$work" && "$project/scripts/mkrootfs.sh" bctest) || { echo "mkrootfs.sh bctest failed" >&2; exit 1; }
fi

# /dev: the nodes work, are 0666 whatever the launcher's umask, and the umask is restored.
check "/dev/null" 0 "$(run bctest /bin/sh -c 'echo x >/dev/null && wc -c </dev/null')"
check "device modes" 666,666 "$( (umask 022; run bctest /usr/bin/stat -c %a /dev/null /dev/tty) | paste -sd, -)"
check "umask" 0022 "$( (umask 022; run bctest /bin/sh -c umask) )"
# The rootfs's own dev directory is untouched by setup.
before=$(ls -A "$work/containers/bctest/dev")
run bctest /bin/true
check "rootfs dev" "$before" "$(ls -A "$work/containers/bctest/dev")"
# A rootfs without proc fails at that step.
mkdir -p "$work/noproc/dev"
err=$(run noproc/ /bin/true 2>&1); [[ $err == *"mount /proc"* ]] || fail "missing proc: $err"
rmdir "$work/noproc/dev" "$work/noproc"

# Descriptors: the host holds fd 9 open on a host directory; the container must not see it.
# ls is a child of sh, so it lists sh's descriptors without a directory fd of its own.
exec 9</
out=$(run bctest /bin/sh -c 'ls /proc/$$/fd')
exec 9<&-
check "descriptors in the container" 0,1,2 "$(paste -sd, - <<<"$out")"
# PID 1 never execs, so anything it kept would be listed.
check "PID 1's descriptors" 0,1,2 "$(run bctest /bin/ls /proc/1/fd | paste -sd, -)"

# Environment: PATH is the Debian default; other host variables pass through.
check "PATH" "$debian_path" "$(run bctest /bin/sh -c 'echo $PATH')"
check "host variable" bar "$(FOO=bar run bctest /bin/sh -c 'echo $FOO')"

# Orphans are reaped by PID 1: no zombie is left. grep -l exits 1 when nothing matches,
# so this checks for empty output and ignores the exit status.
out=$(run bctest /bin/sh -c '(true &); sleep 0.2; grep -l "^State:.Z" /proc/[0-9]*/status')
[[ -z $out ]] || fail "zombie left behind: $out"

# The application's status survives an orphan exiting first.
run bctest /bin/sh -c '(exit 3 &); sleep 0.2; exit 5'; check "status after an orphan exits" 5 $?

# Parent death: killing the host-side bcdocker itself ends the container. Start it
# directly with &, so $! is bcdocker's own pid and not a wrapper subshell. The container's
# processes are found by ancestry (bcdocker, PID 1, sh, sleep), never by name.
cd "$work" || exit 1
"$bcdocker" run bctest /bin/sh -c 'sleep 30' </dev/null >/dev/null 2>&1 &
bcdocker_pid=$!
cd - >/dev/null || exit 1
pid1='' app='' sleeper=''
for _ in $(seq 50); do
  pid1=$(pgrep -P "$bcdocker_pid" | head -1)
  [[ -n $pid1 ]] && app=$(pgrep -P "$pid1" | head -1)
  [[ -n $app ]] && sleeper=$(pgrep -P "$app" | head -1)
  [[ -n $sleeper ]] && break
  sleep 0.1
done
# alive: either process exists and is not a zombie awaiting its new parent's wait.
alive() {
  local p state
  for p in "$app" "$sleeper"; do
    state=$(sed 's/.*) //' "/proc/$p/stat" 2>/dev/null | cut -c1)
    [[ -n $state && $state != Z ]] && return 0
  done
  return 1
}
if [[ -z $sleeper ]]; then
  fail "the container's sleep never started"
  kill -9 "$bcdocker_pid" 2>/dev/null
  { wait "$bcdocker_pid"; } 2>/dev/null
else
  kill -9 "$bcdocker_pid"
  { wait "$bcdocker_pid"; } 2>/dev/null
  for _ in $(seq 20); do alive || break; sleep 0.1; done
  if alive; then
    fail "the container outlived the host-side bcdocker"
    kill -9 "$app" "$sleeper" 2>/dev/null
  fi
fi

if ((failures)); then echo "$failures check(s) failed" >&2; exit 1; fi
echo "ok"
