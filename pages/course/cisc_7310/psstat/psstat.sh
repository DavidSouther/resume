#!/bin/bash

set -euo pipefail

# https://github.com/torvalds/linux/blob/551c722f40809618230001baccf219193e22fc5a/include/uapi/linux/sched.h#L124
sched-name() {
    case $1 in
        0) echo "SCHED_NORMAL(0)" ;;
        1) echo "SCHED_FIFO(1)" ;;
        2) echo "SCHED_RR(2)" ;;
        3) echo "SCHED_BATCH(3)" ;;
        5) echo "SCHED_IDLE(5)" ;;
        6) echo "SCHED_DEADLINE(6)" ;;
        7) echo "SCHED_EXT(7)" ;;
        *) echo "UNKNOWN($1)" ;;
    esac
}

get-pids() {
    (for f in /proc/[0-9]* ; do echo "${f##*/}" ; done) | sort -n
}

pid-sched() {
    sed -E 's/.*\) //' "/proc/$1/stat" | cut -d ' ' -f 39
}

list-short() {
    echo "PID"
    for pid in $(get-pids) ; do
        echo "$pid"
    done
}

list-long() {
    echo "PID CMD ST CMD_ARGS"
    for PID in $(get-pids) ; do
        if [[ -d /proc/$PID && $(cat "/proc/$PID/comm") == "$1" ]] ; then
            COMM="$(cat "/proc/$PID/comm")" || continue
            STAT="$(sed -E 's/.*\) (.).*/\1/' "/proc/$PID/stat")" || continue
            LINE="$(cat "/proc/$PID/cmdline" | tr '\0' ' ' | cut -d ' ' -f 2-)" || continue

            echo "$PID $COMM $STAT $LINE"
        fi
    done
}

list-pid-is() {
    # From https://www.man7.org/linux/man-pages/man5/proc_pid_stat.5.html
    
    # Bash expansion shenanigans to get the first and last parens to separate out (comm)
    stat=$(cat "/proc/$1/stat")
    pid=${stat%% (*}
    stat=${stat#* (}
    comm=${stat%)*}
    rest=${stat##*) }

    read -r state _ppid _pgrp _session _tty_nr _tpgid _flags minflt _cminflt majflt _cmajflt \
            utime stime _cutime _cstime _priority _nice num_threads _itrealvalue _starttime vsize rss \
            _rsslim _startcode _endcode _startstack _kstkesp _kstkeip _signal _blocked _sigignore _sigcatch \
            _wchan _nswap _cnswap _exit_signal _processor _rt_priority _policy _delayacct_blkio_ticks \
            _guest_time _cguest_time _start_data _end_data _start_brk _arg_start _arg_end _env_start \
            _env_end _exit_code \
        <<< "$rest"

    cat <<EOF
     pid: ${pid}
    comm: ${comm}
   state: ${state}
  minflt: ${minflt} 
  majflt: ${majflt}
   utime: ${utime} clock ticks
   stime: ${stime} clock ticks
nthreads: ${num_threads} 
   vsize: ${vsize} bytes
     rss: ${rss} pages
EOF
}

list-sched-policy-is() {
    echo "PID CMD ST SCHED_POLICY CMD_ARGS"
    for PID in $(get-pids) ; do
        if [[ -d /proc/$PID && $(pid-sched "$PID") == "$1" ]] ; then
            COMM="$(cat "/proc/$PID/comm")" || continue
            STAT="$(sed -E 's/.*\) (.).*/\1/' "/proc/$PID/stat")" || continue
            LINE="$(cat "/proc/$PID/cmdline" | tr '\0' ' ' | cut -d ' ' -f 2-)" || continue
            SCHED="$(sched-name "$1")"
            echo "$PID $COMM $STAT $SCHED $LINE"
        fi
    done
}

usage() {
    cat <<EOF
Usage: $0 [OPTION] ...
List process information.
Options are
 --list-short                  list all processes in short format
 --list-long                   list all processes in long format
 --list-name-has <name_part>   list all processes whose name has name_part in long format
 --list-pid-is <pid>           list status of the process whose pid is <pid>
 --list-sched-policy-is <policy_number> list all processes whose CPU scheduling policy number is <policy_number> in long format
EOF
}

case "${1:-}" in
    --help)
        usage "$0"
        ;;
    --list-short)
        list-short
        ;;
    --list-long)
        list-long '*'
        ;;
    --list-name-has)
        list-long "*${2:?missing <name_part>}*"
        ;;
    --list-pid-is)
        list-pid-is "${2:?missing <pid>}"
        ;;
    --list-sched-policy-is)
        list-sched-policy-is "${2:?missing <policy_number>}"
        ;;
    *)
        usage "$0" >&2
        exit 2
        ;;
esac
