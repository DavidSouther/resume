# `psstat.sh` mini-ps

A bash-based `ps(1)` substitute.

Processes are discovered with a simple `ls /proc` in a subshell,
and then filtering to entries that matched a digits-only shell
expansion pattern. Further details are read from `/proc/<pid>/<file>` as necessary. 

Comm(and) and Command Line come from `/proc/<pid>/comm` and `.../cmdline`
without additional processing. `/proc/<pid>/stat` is parsed in two ways.
When looking for just the program state (running, idle, etc), it looks for
the string pattern. Since the state is the only letter string in the 

Using `./linux` to prepare an appropriate Linux docker container,
run `./questions.sh` to execute `psstate.sh` under several
conditions, providing traces for the below questions.

 
> The read syscall count. How many times does your script call read(2) on files under /proc when running --list-short? Justify your answer by examining the trace, not by guessing. Providing the trace.

`--list-short` does not call `read` for files under `/proc`. After opening
a file descriptor for the `/proc` folder, `getdents`/`getdents64` reads
directory information to retrieve the list of `/proc/<pid>` values.
 
> Break it on purpose. Modify your script to read /proc/1/stat from a non-root user. What happens? Which syscall returns the error? What is the errno? Why does the kernel allow this even though /proc/1/ is “owned” by root?

`/proc/1/stat` is mode 0444, global readable. This is likely to allow
other programs to see overall system stats. Accessing a 0400 file, like
`/proc/1/environ`, provides an access denied error.

> Field-counting in /proc/${pid}/stat. The stat file’s comm field is in parentheses and may contain spaces and parentheses. Explain why a naive cut -d' ' -f2 fails on a process named test (123). What is the correct way to extract comm, and why does the kernel wrap it in parentheses in the first place?

Command names may contain `(` and `)`. In this version, bash substring
patten matching breaks the string into PID up to first open paren, then
from last close paren to the end into rest, and finds the middle of those
for the command.
 
> PIDs are not contiguous. In the --list-short example, the PIDs are something like 1, 10, 101, 103, 105, 106, 10852. Why are there gaps? Does your script assume PIDs are contiguous, and if so, what breaks?

Gaps occur as programs exit. This script does not assume PIDs are
contiguous, and does not break.
 
> /proc is not a real filesystem. /proc/${pid}/stat reports utime and stime. Where do these numbers actually come from? Are they stored on disk? If not, how does reading the file work, i.e., what does the kernel do when you read(2) it?
 
> Compare with ps. Run ps -eo pid,stat,comm,args and compare its output with ./psstat --list-long. Identify at least three differences. For each, explain which /proc file ps is likely reading and which field it is deriving that your script does not.

`ps -eo` includes the `+` marker for processes in the foreground group; as this has some programs in the brackground, not all have a `+` on their
status. This `psstat.sh` does not attempt to determine process groups,
foreground or otherwise.

> The scheduling policy mapping. The spec says the textual policy name (e.g., SCHED_NORMAL) comes from /usr/include/linux/sched.h. Read that header and list every SCHED_* constant and its numeric value. Is the mapping from number to name one-to-one? Are there numbers that appear in /proc/${pid}/stat but have no constant in that header?
 
From https://github.com/torvalds/linux/blob/551c722f40809618230001baccf219193e22fc5a/include/uapi/linux/sched.h#L128

/* SCHED_ISO: reserved but not implemented yet */ and would have value `4`.
It does appear to be 1 to 1.

> Reproduce a failure. Under what conditions would ./psstat --list-pid-is <pid> fail with a “No such file or directory” error even though the process exists? Give a concrete scenario.

If the process with `<pid>` has exited, this will fail with File Not Found.
Alternately, specifying a nonsense `<pid>` like `-10` or `wheewhoo` would
fail. Specifying a non-process name that maps to another file in `/proc`
would give undefined behavior, as the program will attempt to read files
under that name as a directory.
 
> Design note. In 0.5 - 1 pages, explain how your script discovers processes, how it parses /proc/${pid}/stat, and what happens if a process exits while you are reading it. Include at least one thing you tried that did not work and how you resolved it.