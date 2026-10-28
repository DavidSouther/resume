#!/usr/bin/env bash
# Run the psstat experiment: start the dev container with ./linux, then run
# scripts/psstat-run.sh in it, which runs ../psstat/questions.sh in a bcdocker container and
# writes ANSWERS.md, run.log, and traces/ here.

set -euo pipefail
cd "$(dirname "$0")/.."
exec ./linux scripts/psstat-run.sh
