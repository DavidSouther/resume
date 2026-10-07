# Start `yes` in the background to have something to see

cd $(dirname $0)

uname -a

./'my (yes) sh' foo bar baz &

mkdir -p traces

# strace -o traces/list-shed-policy -f ./psstat.sh --list-sched-policy-is 0
# egrep 'openat.*/proc/' traces/list-shed-policy

# strace -o traces/list-short -f ./psstat.sh --list-short
# egrep -A3 "openat.*/proc" traces/list-short

ps -eo pid,stat,comm,args
./psstat.sh --list-long

./psstat.sh --list-pid-is -10

id -u
ls -l /proc/1/stat /proc/1/environ
su -s /bin/bash nobody -c './psstat.sh --list-pid-is 1 ; cat /proc/1/environ'

kill %1

exit