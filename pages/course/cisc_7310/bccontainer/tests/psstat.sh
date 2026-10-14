#!/usr/bin/env bash
# Feature test for psstat.sh inside a bcdocker container.
#
# Builds a bookworm-slim container root, which includes /usr/local/bin/psstat.sh, and runs each
# psstat option in it. The container's PID namespace holds only bcdocker (PID 1) and the
# application (PID 2), so the output is mostly predictable.
#
# Run on a Linux host with Docker or crane:
#
#     cargo build && sudo tests/psstat.sh
#
# BCDOCKER overrides the binary under test.

set -u

project=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
bcdocker=${BCDOCKER:-$project/target/debug/bcdocker}
work=$project/target/test-work
failures=0

fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }
check() { [[ "$2" == "$3" ]] || fail "$1: expected '$2', got '$3'"; }
has() { [[ $3 == *"$2"* ]] || fail "$1: missing '$2' in: $3"; }
# psstat <args...>: psstat.sh in the container, from the scratch working directory.
psstat() { (cd "$work" && "$bcdocker" run bctest /usr/local/bin/psstat.sh "$@" </dev/null); }

[[ $(id -u) == 0 ]] || { echo "bcdocker needs root: sudo tests/psstat.sh" >&2; exit 1; }
[[ -x $bcdocker ]] || { echo "no binary at $bcdocker: run cargo build first" >&2; exit 1; }

mkdir -p "$work"
if [[ ! -d $work/containers/bctest ]]; then
  (cd "$work" && "$project/scripts/mkrootfs.sh" bctest) || { echo "mkrootfs.sh bctest failed" >&2; exit 1; }
fi
[[ -x $work/containers/bctest/usr/local/bin/psstat.sh ]] || fail "psstat.sh is not installed in the container"

out=$(psstat --list-short 2>&1); check "--list-short exit status" 0 $?
# Subshells psstat.sh forks while listing may appear too, so check only the fixed entries.
check "--list-short header" PID "$(head -n 1 <<<"$out")"
[[ $'\n'$out$'\n' == *$'\n1\n'* && $'\n'$out$'\n' == *$'\n2\n'* ]] || fail "--list-short lacks PIDs 1 and 2: $out"

out=$(psstat --list-long 2>&1); check "--list-long exit status" 0 $?
check "--list-long header" "PID CMD ST CMD_ARGS" "$(head -n 1 <<<"$out")"
has "--list-long" "1 bcdocker " "$out"

out=$(psstat --list-name-has bcdock 2>&1); check "--list-name-has exit status" 0 $?
has "--list-name-has" "1 bcdocker " "$out"
[[ $(wc -l <<<"$out") -eq 2 ]] || fail "--list-name-has matched more than bcdocker: $out"

out=$(psstat --list-pid-is 1 2>&1); check "--list-pid-is exit status" 0 $?
has "--list-pid-is" "pid: 1" "$out"
has "--list-pid-is" "comm: bcdocker" "$out"
has "--list-pid-is" "nthreads:" "$out"

out=$(psstat --list-sched-policy-is 0 2>&1); check "--list-sched-policy-is exit status" 0 $?
check "--list-sched-policy-is header" "PID CMD ST SCHED_POLICY CMD_ARGS" "$(head -n 1 <<<"$out")"
has "--list-sched-policy-is" "SCHED_NORMAL(0)" "$out"

out=$(psstat --help 2>&1); check "--help exit status" 0 $?
has "--help" "Usage:" "$out"

psstat --bogus >/dev/null 2>&1; check "unknown option exit status" 2 $?

if ((failures)); then echo "$failures check(s) failed" >&2; exit 1; fi
echo "ok"
