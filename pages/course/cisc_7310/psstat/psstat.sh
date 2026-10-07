#!/bin/bash

set -euo pipefail

PID_PATTERN='+([0123456789])'
STATE_PATTERN='[RSDZTtWXxKkPI]' # From https://www.man7.org/linux/man-pages//man5/proc_pid_stat.5.html

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
    esac
}

get-pids() {
    for f in $(ls -1v /proc) ; do if [[ $f == $PID_PATTERN ]] ; then echo $f ; fi ; done
}

pid-sched() {
    cat /proc/$1/sched | grep policy | awk -F':' '{print $2}' | tr -d ' '
}

list-short() {
    echo "PID"
    for pid in $(get-pids) ; do
        echo $pid
    done
}

list-long() {
    echo "PID CMD ST CMD_ARGS"
    for PID in $(get-pids) ; do
        if [[ -d /proc/$PID && $(cat /proc/$PID/comm) == $1 ]] ; then
            COMM="$(cat /proc/$PID/comm)"
            STAT="$(cat /proc/$PID/stat | grep -o "$STATE_PATTERN" | head -1)"
            LINE="$(cat /proc/$PID/cmdline | tr '\0' ' ' | cut -d ' ' -f 2-)"

            echo "$PID $COMM $STAT $LINE"
        fi
    done
}

list-pid-is() {
    # From https://www.man7.org/linux/man-pages//man5/proc_pid_stat.5.html
    
    # Bash expansion shenanigans to get the first and last parens to separate out (comm)
    stat=$(cat /proc/$1/stat)
    pid=${stat%% (*}
    stat=${stat#* (}
    comm=${stat%)*}
    rest=${stat##*) }

    read -r state ppid pgrp session tty_nr tpgid flags minflt cminflt majflt cmajflt \
            utime stime cutime cstime priority nice num_threads itrealvalue starttime vsize rss \
            rsslim startcode endcode startstack kstkesp kstkeip signal blocked sigignore sigcatch \
            wchan nswap cnswap exit_signal processor rt_priority policy delayacct_blkio_ticks \
            guest_time cguest_time start_data end_data start_brk arg_start arg_end env_start \
            env_end exit_code \
        < <(cat /proc/$1/stat)

    cat <<EOF
        pid: ${pid}
       comm: ${comm}
      state: ${state}
     minflt: ${minflt} 
     majflt: ${majflt}
      utime: ${utime} clock ticks
      stime: ${stime} clock ticks
num_threads: ${num_threads} 
      vsize: ${vsize} bytes
        rss: ${rss} pages
EOF
}

list-sched-policy-is() {
    echo "PID CMD ST SCHED_POLICY CMD_ARGS"
    for PID in $(get-pids) ; do
        if [[ -d /proc/$PID && $(pid-sched $PID) == $1 ]] ; then
            COMM="$(cat /proc/$PID/comm)"
            STAT="$(cat /proc/$PID/stat | grep -o "$STATE_PATTERN" | head -1)"
            LINE="$(cat /proc/$PID/cmdline | tr '\0' ' ' | cut -d ' ' -f 2-)"
            SCHED="$(sched-name $1)"
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

case "$1" in
    --list-short)
        list-short
        ;;
    --list-long)
        list-long '*'
        ;;
    --list-name-has)
        list-long "*$2*"
        ;;
    --list-pid-is)
        list-pid-is "$2"
        ;;
    --list-sched-policy-is)
        list-sched-policy-is "$2"
        ;;
    *)
        usage "$0"
        ;;
esac
