"""Install a daily cron job or create a key on an offline machine."""

import argparse
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys

MARKER = "# pgbackup-hw8"


def add_install_options(parser: argparse.ArgumentParser) -> None:
    group = parser.add_argument_group("installation")
    group.add_argument("--install", action="store_true", help="install a cron job or create a key")
    group.add_argument("--schedule", help="cron schedule (default: 17 2 * * *)")
    group.add_argument("--log", help="cron log path (default: ~/pgbackup.log)")
    group.add_argument("--print", action="store_true", dest="dry")
    group.add_argument("--create-key", metavar="USER_ID", help="create a GPG key without installing cron")
    group.add_argument("--public-key-out", type=Path, help="export the generated public key to this file")
    parser.add_argument("backup_args", nargs=argparse.REMAINDER)


def install(args: argparse.Namespace, parser: argparse.ArgumentParser) -> int:
    if args.schedule is None:
        args.schedule = "17 2 * * *"
    if args.log is None:
        args.log = str(Path.home() / "pgbackup.log")
    if args.create_key:
        if args.backup_args or not args.public_key_out or args.dry:
            parser.error("--create-key requires --public-key-out and cannot install cron")
        fingerprint = None
        created = False
        try:
            # Reserve the destination before creating a durable private key.
            fd = os.open(args.public_key_out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            created = True
            with os.fdopen(fd, "wb") as output:
                result = subprocess.run(
                    ["gpg", "--status-fd", "1", "--quick-gen-key", args.create_key,
                     "default", "default", "never"], check=True, stdout=subprocess.PIPE, text=True,
                )
                for line in result.stdout.splitlines():
                    fields = line.split()
                    if len(fields) == 4 and fields[:2] == ["[GNUPG:]", "KEY_CREATED"]:
                        fingerprint = fields[3]
                        break
                if not fingerprint:
                    raise ValueError("GPG did not report the new key's fingerprint")
                public_key = subprocess.run(["gpg", "--export", "--armor", fingerprint], check=True, capture_output=True).stdout
                if not public_key:
                    raise ValueError("GPG exported no public key")
                output.write(public_key)
            print(f"wrote {args.public_key_out}; fingerprint: {fingerprint}; keep the private key offline")
            return 0
        except (OSError, ValueError, subprocess.CalledProcessError) as e:
            print(f"error: key creation failed: {e}", file=sys.stderr)
            if created:
                try:
                    args.public_key_out.unlink(missing_ok=True)
                except OSError as cleanup_error:
                    print(f"error: could not remove incomplete output: {cleanup_error}", file=sys.stderr)
                if fingerprint:
                    print(f"The private key {fingerprint} may already exist. Recover its public key with: "
                          f"gpg --armor --export {shlex.quote(fingerprint)} > {shlex.quote(str(args.public_key_out))}", file=sys.stderr)
                else:
                    print("A private key may have been created. Check gpg --list-secret-keys --fingerprint before retrying.", file=sys.stderr)
            return 1
    if args.public_key_out:
        parser.error("--public-key-out requires --create-key")
    backup_args = args.backup_args
    if backup_args and backup_args[0] == "--":
        backup_args = backup_args[1:]
    if not backup_args:
        parser.error("backup arguments required after --")
    if any("\n" in value or "\r" in value for value in [args.schedule, args.log, *backup_args]):
        parser.error("newlines are not supported in cron entries")
    for tool in ("psql", "gpg", "uv", "crontab"):
        if not shutil.which(tool):
            print(f"error: {tool} not found on PATH", file=sys.stderr)
            return 2
    directories = []
    for tool in ("psql", "gpg", "uv"):
        path = shutil.which(tool)
        if shutil.which("mise"):
            result = subprocess.run(["mise", "which", tool], capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                path = result.stdout.strip()
        directory = str(Path(path).parent)
        if directory not in directories:
            directories.append(directory)
    tool_path = ":".join([*directories, "/usr/bin", "/bin"])
    script = Path(__file__).resolve().with_name("backup.py")
    command = " ".join(map(shlex.quote, [str(script), *backup_args]))
    line = f"{args.schedule} PATH={shlex.quote(tool_path)} {command} >> {shlex.quote(args.log)} 2>&1 {MARKER}".replace("%", r"\%")
    if args.dry:
        print(line)
        return 0
    result = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    if result.returncode and "no crontab" not in result.stderr.lower():
        print(f"error: crontab -l failed: {result.stderr.strip()}", file=sys.stderr)
        return 1
    existing = [line for line in result.stdout.splitlines() if MARKER not in line]
    result = subprocess.run(["crontab", "-"], input="\n".join([*existing, line]) + "\n", text=True)
    if result.returncode:
        return result.returncode
    print(f"installed:\n{line}")
    return 0
