# Start `yes` in the background to have something to see

cd $(dirname $0)

./'my (yes) sh' foo bar baz &

mkdir -p traces
strace -o traces/list-short -ff ./psstat.sh --list-short

ps -eo pid,stat,comm,args
./psstat.sh --list-long

exit