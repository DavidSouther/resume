#!/usr/bin/env bash
# Run the ctxswitch experiment (tests/run.sh) on EC2 spot instances of several configurations.
#
#   ./scripts-aws.sh                                  # c7i.large (Intel x86), c7a.large (AMD x86), c7g.large (Graviton arm)
#   ./scripts-aws.sh --types c7i.large,c8g.large      # pick instance types
#   ./scripts-aws.sh --region us-west-2 --profile foo # override region or AWS profile (default profile otherwise)
#   ./scripts-aws.sh --keep                           # leave instances, key, and security group in place (for debugging)
#
# For each type: launches a Debian 13 spot instance in the default VPC, copies this crate over ssh,
# installs Docker, runs tests/run.sh (same container limits as a local run), and copies the results
# to results/aws/<run>/<type>/. Everything it creates is tagged ctxswitch-run=<run> and is removed on
# exit (also on Ctrl-C or failure) unless --keep is given. Spot instances are one-time and terminate
# on interruption, so cost is a few cents per type for the roughly 10 minutes each takes.

set -euo pipefail

cd "$(dirname "$0")"
project=$PWD

types=c7i.large,c7a.large,c7g.large
keep=0
export AWS_PAGER=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --types) types=$2; shift 2 ;;
    --region) export AWS_DEFAULT_REGION=$2; shift 2 ;;
    --profile) export AWS_PROFILE=$2; shift 2 ;;
    --keep) keep=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

run_id=$(date -u +%Y%m%dT%H%M%SZ)
out=$project/results/aws/$run_id
work=$(mktemp -d)
key_name=ctxswitch-$run_id
sg_name=ctxswitch-$run_id
mkdir -p "$out"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
tag_spec() { echo "ResourceType=$1,Tags=[{Key=ctxswitch-run,Value=$run_id},{Key=Name,Value=ctxswitch-$run_id}]"; }

sg_id=
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ $keep -eq 1 ]]; then
    log "--keep: leaving resources tagged ctxswitch-run=$run_id (key file $work/key.pem)"
    exit $rc
  fi
  log "cleanup"
  local ids
  ids=$(aws ec2 describe-instances --filters "Name=tag:ctxswitch-run,Values=$run_id" \
          "Name=instance-state-name,Values=pending,running,stopping,stopped" \
          --query 'Reservations[].Instances[].InstanceId' --output text)
  if [[ -n $ids ]]; then
    # shellcheck disable=SC2086
    aws ec2 terminate-instances --instance-ids $ids >/dev/null
    # shellcheck disable=SC2086
    aws ec2 wait instance-terminated --instance-ids $ids || true
  fi
  [[ -n $sg_id ]] && aws ec2 delete-security-group --group-id "$sg_id" >/dev/null 2>&1 || true
  aws ec2 delete-key-pair --key-name "$key_name" >/dev/null 2>&1 || true
  rm -rf "$work"
  exit $rc
}
trap cleanup EXIT INT TERM

log "account $(aws sts get-caller-identity --query Account --output text), region $(aws configure get region || echo "$AWS_DEFAULT_REGION")"

# One key pair and one security group (ssh from this machine only) shared by every instance of the run.
aws ec2 create-key-pair --key-name "$key_name" --key-type ed25519 --query KeyMaterial --output text >"$work/key.pem"
chmod 600 "$work/key.pem"
my_ip=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')
vpc_id=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
sg_id=$(aws ec2 create-security-group --group-name "$sg_name" --description "ctxswitch $run_id" \
          --vpc-id "$vpc_id" --tag-specifications "$(tag_spec security-group)" --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id "$sg_id" --protocol tcp --port 22 --cidr "$my_ip/32" >/dev/null
log "key $key_name, security group $sg_id (ssh from $my_ip/32)"

ssh_opts=(-i "$work/key.pem" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR
          -o ConnectTimeout=10 -o ServerAliveInterval=30)

# run_one <type>: everything for one instance. Writes its log to $out/<type>.log.
run_one() {
  local type=$1 dest=$out/$1
  mkdir -p "$dest"
  local arch ami
  arch=$(aws ec2 describe-instance-types --instance-types "$type" \
           --query 'InstanceTypes[0].ProcessorInfo.SupportedArchitectures[0]' --output text)
  case $arch in
    x86_64) ami=$(aws ssm get-parameter --name /aws/service/debian/release/13/latest/amd64 --query Parameter.Value --output text) ;;
    arm64)  ami=$(aws ssm get-parameter --name /aws/service/debian/release/13/latest/arm64 --query Parameter.Value --output text) ;;
    *) echo "$type: unsupported architecture $arch" >&2; return 1 ;;
  esac
  echo "$type: $arch, $ami"

  local id
  id=$(aws ec2 run-instances --image-id "$ami" --instance-type "$type" --key-name "$key_name" \
         --security-group-ids "$sg_id" --count 1 \
         --instance-market-options 'MarketType=spot,SpotOptions={SpotInstanceType=one-time,InstanceInterruptionBehavior=terminate}' \
         --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3,DeleteOnTermination=true}' \
         --tag-specifications "$(tag_spec instance)" "$(tag_spec volume)" \
         --query 'Instances[0].InstanceId' --output text) || { echo "$type: spot request failed (capacity or quota)"; return 1; }
  echo "$type: instance $id"
  aws ec2 wait instance-running --instance-ids "$id"
  local ip
  ip=$(aws ec2 describe-instances --instance-ids "$id" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
  echo "$type: $ip"

  local n=0
  until ssh "${ssh_opts[@]}" "admin@$ip" true 2>/dev/null; do
    n=$((n + 1)); [[ $n -lt 40 ]] || { echo "$type: ssh never came up"; return 1; }
    sleep 5
  done
  sshx() { ssh "${ssh_opts[@]}" "admin@$ip" "$@"; }

  sshx 'sudo cloud-init status --wait >/dev/null 2>&1 || true
        sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io python3 >/dev/null
        sudo systemctl enable --now docker'
  COPYFILE_DISABLE=1 tar --exclude=./target --exclude=./results --exclude=./.git -czf - . | sshx 'mkdir -p ctxswitch && tar xzf - -C ctxswitch'

  # Machine description, saved next to the results (what the numbers were measured on).
  sshx "{ echo \"instance_type=$type\"; echo \"instance_id=$id\"; echo \"architecture=$arch\"; echo \"ami=$ami\"
          echo \"kernel=\$(uname -r)\"; echo \"docker=\$(sudo docker --version)\"; echo; lscpu; } >machine.txt"

  # tests/run.sh exits nonzero when an assertion on the evidence fails; the results are still wanted.
  local rc=0
  sshx 'cd ctxswitch && sudo bash tests/run.sh --results-dir "$HOME/ctxswitch-results" && sudo chown -R admin: "$HOME/ctxswitch-results"' || rc=$?
  echo "$type: tests/run.sh exit $rc"
  sshx 'sudo chown -R admin: "$HOME/ctxswitch-results"; cp machine.txt "$HOME/ctxswitch-results/"; tar czf - -C "$HOME/ctxswitch-results" .' | tar xzf - -C "$dest"
  echo "$type: results in $dest"
  return $rc
}

pids=()
IFS=, read -ra list <<<"$types"
for t in "${list[@]}"; do
  log "start $t (log: $out/$t.log)"
  run_one "$t" >"$out/$t.log" 2>&1 &
  pids+=($!)
done

status=0
for i in "${!list[@]}"; do
  if wait "${pids[$i]}"; then log "${list[$i]}: ok"; else log "${list[$i]}: FAILED (see $out/${list[$i]}.log)"; status=1; fi
done

# Side by side summary of ns per switch at working set 0.
python3 - "$out" "${list[@]}" <<'PY' || true
import csv, os, sys
out, types = sys.argv[1], sys.argv[2:]
data = {}
for t in types:
    p = os.path.join(out, t, "bench.csv")
    if os.path.exists(p):
        data[t] = {r["mechanism"]: float(r["ns_per_switch"]) for r in csv.DictReader(open(p)) if r["working_set_bytes"] == "0"}
if data:
    mechs = ["thread", "process", "ucontext", "regswitch", "green", "baseline-socket", "baseline-sigprocmask"]
    print("\nns per switch, working set 0")
    print(f'{"mechanism":<22}' + "".join(f"{t:>14}" for t in data))
    for m in mechs:
        print(f"{m:<22}" + "".join(f"{d.get(m, float('nan')):>14.1f}" for d in data.values()))
PY
log "results: $out"
exit $status
