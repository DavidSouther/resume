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
