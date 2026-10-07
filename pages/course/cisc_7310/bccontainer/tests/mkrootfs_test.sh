#!/usr/bin/env bash
# Tests for scripts/mkrootfs.sh. docker and crane are stubs, so no network is used.
#
#     tests/mkrootfs_test.sh

set -u

project=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
script=$project/scripts/mkrootfs.sh
bash_bin=$(command -v bash)
failures=0

fail() { echo "FAIL: $CURRENT: $*" >&2; failures=$((failures + 1)); }
check() { [[ "$2" == "$3" ]] || fail "$1: expected '$2', got '$3'"; }

case $(uname -m) in
  x86_64 | amd64) arch=amd64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

# new_case: a scratch working directory with stub tools. Sets work, stubs, log, minimal.
new_case() {
  CURRENT=$1
  work=$(mktemp -d)
  stubs=$work/stubs; log=$work/log; minimal=$work/minimal
  mkdir -p "$stubs" "$minimal" "$work/fixture/etc" "$work/run"
  echo 'PRETTY_NAME="stub"' >"$work/fixture/etc/os-release"
  : >"$log"
  # Each stub logs its call and exports the fixture as a tar; docker also answers info, create and rm.
  cat >"$stubs/docker" <<STUB
#!/usr/bin/env bash
echo "docker \$*" >>"$log"
case \$1 in
  info) [[ -z \${STUB_DOCKER_INFO_FAIL:-} ]] ;;
  create) echo stubid ;;
  export) tar -c -C "$work/fixture" .; [[ -z \${STUB_EXPORT_FAIL:-} ]] ;;
  rm) ;;
esac
STUB
  cat >"$stubs/crane" <<STUB
#!/usr/bin/env bash
echo "crane \$*" >>"$log"
tar -c -C "$work/fixture" .
STUB
  chmod +x "$stubs/docker" "$stubs/crane"
  # A PATH with only the tools the script needs, so the host's real docker is not found.
  for t in bash tar mktemp uname chmod mv rm mkdir cat; do ln -s "$(command -v $t)" "$minimal/$t"; done
}

mk() { (cd "$work/run" && PATH="$stubs:$PATH" "$bash_bin" "$script" "$@"); }
mk_minimal() { (cd "$work/run" && PATH="$minimal" "$bash_bin" "$script" "$@"); }
done_case() { rm -rf "$work"; }

new_case "builds the container directory"
mk tinysys >/dev/null 2>&1; check "exit status" 0 $?
[[ -f $work/run/containers/tinysys/etc/os-release ]] || fail "os-release not extracted"
check "mode" 755 "$(stat -c %a "$work/run/containers/tinysys")"
grep -q "docker create --platform linux/$arch debian:bookworm-slim" "$log" || fail "docker create platform: $(cat "$log")"
done_case

new_case "a second run leaves the first build untouched"
mk tinysys >/dev/null 2>&1; touch "$work/run/containers/tinysys/marker"
mk tinysys >/dev/null 2>&1; [[ $? -ne 0 ]] || fail "second run exited 0"
[[ -f $work/run/containers/tinysys/marker ]] || fail "first build was modified"
done_case

new_case "an export that fails midway leaves nothing behind"
STUB_EXPORT_FAIL=1 mk tinysys >/dev/null 2>&1; [[ $? -ne 0 ]] || fail "failed export exited 0"
[[ -z $(ls -A "$work/run/containers" 2>/dev/null) ]] || fail "left behind: $(ls -A "$work/run/containers")"
grep -q "docker rm -f stubid" "$log" || fail "created container not removed: $(cat "$log")"
done_case

new_case "crane is used when docker is not on PATH"
ln -s "$stubs/crane" "$minimal/crane"
mk_minimal tinysys >/dev/null 2>&1; check "exit status" 0 $?
[[ -f $work/run/containers/tinysys/etc/os-release ]] || fail "os-release not extracted"
grep -q "^crane export --platform linux/$arch debian:bookworm-slim -" "$log" || fail "crane arguments: $(cat "$log")"
done_case

new_case "crane is used when the docker daemon is unreachable"
STUB_DOCKER_INFO_FAIL=1 mk tinysys >/dev/null 2>&1; check "exit status" 0 $?
grep -q '^crane export' "$log" || fail "crane not used: $(cat "$log")"
grep -q '^docker create' "$log" && fail "docker create ran with the daemon down"
done_case

new_case "an image argument replaces the default with docker"
mk tinysys alpine:3.20 >/dev/null 2>&1; check "exit status" 0 $?
grep -q "docker create --platform linux/$arch alpine:3.20" "$log" || fail "docker create image: $(cat "$log")"
grep -q 'bookworm' "$log" && fail "the default image was used: $(cat "$log")"
done_case

new_case "an image argument replaces the default with crane"
ln -s "$stubs/crane" "$minimal/crane"
mk_minimal tinysys ubuntu:24.04 >/dev/null 2>&1; check "exit status" 0 $?
grep -q "^crane export --platform linux/$arch ubuntu:24.04 -" "$log" || fail "crane image: $(cat "$log")"
done_case

new_case "more than two arguments is a usage error"
err=$(mk tinysys debian:bookworm-slim extra 2>&1 >/dev/null); code=$?
[[ $code -ne 0 ]] || fail "exited 0"
[[ $err == *"usage: mkrootfs.sh <name> [image]"* ]] || fail "message: $err"
[[ -z $(ls -A "$work/run/containers" 2>/dev/null) ]] || fail "left behind: $(ls -A "$work/run/containers")"
done_case

new_case "a name that is not a hostname is refused before anything is built"
for bad in "" . .. a/b ../x "$(printf 'a%.0s' $(seq 65))"; do
  err=$(mk "$bad" 2>&1 >/dev/null); code=$?
  [[ $code -ne 0 ]] || fail "${bad:0:10}: exited 0"
  [[ $err == *"name must be"* ]] || fail "${bad:0:10}: message: $err"
done
[[ -z $(ls -A "$work/run" 2>/dev/null) ]] || fail "left behind: $(ls -A "$work/run")"
[[ ! -s $log ]] || fail "tools ran: $(cat "$log")"
done_case

new_case "neither docker nor crane gives an install hint"
err=$(mk_minimal tinysys 2>&1 >/dev/null); code=$?
[[ $code -ne 0 ]] || fail "exited 0 with no tools"
[[ $err == *"install docker or crane"* ]] || fail "message: $err"
[[ -z $(ls -A "$work/run/containers" 2>/dev/null) ]] || fail "left behind: $(ls -A "$work/run/containers")"
done_case

if ((failures)); then echo "$failures check(s) failed" >&2; exit 1; fi
echo ok
