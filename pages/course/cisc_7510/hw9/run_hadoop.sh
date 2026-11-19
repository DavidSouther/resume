#!/usr/bin/env bash
# Run the flying-car violator pipeline as three Hadoop Streaming jobs.
# Usage: ./run_hadoop.sh [local|hdfs] DATA.csv [OUT_DIR] [extra flying.py args, e.g. --k 5 --stride 1]
#   local  mapreduce.framework.name=local on the local filesystem (no daemons needed)
#   hdfs   submit to a running 1-node cluster (see setup_pseudo.sh); data is copied to HDFS
# Writes violating VINs, one per line, to OUT_DIR/violators.txt (default ./out).
set -euo pipefail

mode="${1:?mode: local|hdfs}"; data="${2:?data file}"; out="${3:-out}"
shift $(( $# < 3 ? $# : 3 ))
extra=("$@")

here="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${HADOOP_HOME:-}" ]; then
  HADOOP_HOME="$(brew --prefix hadoop)/libexec"
fi
export HADOOP_HOME
if [ -z "${JAVA_HOME:-}" ]; then
  export JAVA_HOME="$(/usr/libexec/java_home 2>/dev/null || brew --prefix openjdk@17)/"
fi
hadoop="$HADOOP_HOME/bin/hadoop"
jar="$(ls "$HADOOP_HOME"/share/hadoop/tools/lib/hadoop-streaming-*.jar | head -1)"

if [ "$mode" = local ]; then
  conf=(-D mapreduce.framework.name=local -fs file:///)
  workdir="$(mktemp -d)"
  trap 'rm -rf "$workdir"' EXIT
  base="$workdir/jobs"
  inp="$(cd "$(dirname "$data")" && pwd)/$(basename "$data")"
  fetch() { cat "$1"/part-*; }
elif [ "$mode" = hdfs ]; then
  conf=()
  export HADOOP_CONF_DIR="${HADOOP_CONF_DIR:-$here/conf-pseudo}"
  workdir="$(mktemp -d)"
  base="/user/$USER/flying/$(basename "$workdir")"
  trap '"$hadoop" fs -rm -r -f -skipTrash "$base" >/dev/null 2>&1 || true; rm -rf "$workdir"' EXIT
  inp="$base/input/$(basename "$data")"
  "$hadoop" fs -mkdir -p "$(dirname "$inp")"
  "$hadoop" fs -put -f "$data" "$inp"
  fetch() { "$hadoop" fs -cat "$1"/part-*; }
else
  echo "mode must be local or hdfs" >&2; exit 2
fi

# Ship the candidate list to each mapper under a predictable local name.
files=("$here/flying.py")
mapper_args=()
while (( ${#extra[@]} )); do
  case "${extra[0]}" in
    --vins)
      if (( ${#extra[@]} < 2 )); then echo "--vins requires a file" >&2; exit 2; fi
      files+=("${extra[1]}#candidate-vins.txt")
      mapper_args+=(--vins candidate-vins.txt)
      extra=("${extra[@]:2}") ;;
    --vins=*)
      files+=("${extra[0]#--vins=}#candidate-vins.txt")
      mapper_args+=(--vins candidate-vins.txt)
      extra=("${extra[@]:1}") ;;
    *) mapper_args+=("${extra[0]}"); extra=("${extra[@]:1}") ;;
  esac
done
args="${mapper_args[*]:-}"
files_arg="$(IFS=,; echo "${files[*]}")"
secs=0
stream() { # name input output mapper reducer reduces; sets secs to the job's elapsed seconds
  echo ">> $1" >&2
  local start; start=$(date +%s)
  "$hadoop" jar "$jar" ${conf[@]+"${conf[@]}"} \
    -D mapreduce.job.name="flying-$1" -D mapreduce.job.reduces="$6" \
    -files "$files_arg" \
    -input "$2" -output "$3" -mapper "$4" -reducer "$5" 2>&1 | tail -3 >&2
  secs=$(( $(date +%s) - start ))
}

# A one-row identity job approximates launch overhead; subtract it from each job time.
tiny="$workdir/baseline.csv"; echo "x,0,0,0,0" > "$tiny"
if [ "$mode" = local ]; then tinyin="$tiny"; else
  tinyin="$base/baseline-input.csv"; "$hadoop" fs -put -f "$tiny" "$tinyin"; fi
stream baseline "$tinyin" "$base/baseline" "cat" "cat" 1; t_base=$secs
rm -f "$tiny"

R="${REDUCERS:-2}"
stream cells "$inp" "$base/pairs_by_ts" "python3 flying.py map $args" "python3 flying.py cell $args" "$R"; t_cells=$secs
stream runs "$base/pairs_by_ts" "$base/violating_pairs" "cat" "python3 flying.py runs $args" "$R"; t_runs=$secs
stream vins "$base/violating_pairs" "$base/violators" "python3 flying.py vins" "python3 flying.py distinct" 1; t_vins=$secs
total=$(( t_cells + t_runs + t_vins ))
echo "TIMES baseline_per_job=${t_base}s cells=${t_cells}s runs=${t_runs}s vins=${t_vins}s total=${total}s post_startup=$(( total - 3 * t_base ))s" >&2

mkdir -p "$out"
fetch "$base/violators" | cut -f1 | sort > "$out/violators.txt"
wc -l < "$out/violators.txt" | xargs echo "violators:" >&2
