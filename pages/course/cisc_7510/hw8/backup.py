#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["shgit @ git+https://github.com/davidsouther/shgit@8487c3516f97eec69317729246db06bfe30a5a3e"]
# ///
"""Back up one Postgres table as CSV, gzip it, and encrypt it with a GPG public key.

Pipeline: psql COPY ... TO STDOUT (csv, via shgit) -> gzip (in memory) -> gpg --encrypt
-> <outdir>/<table>-YYYYMMDD.csv.gz.gpg. A second run on the same day replaces that file.
No plaintext touches disk. The whole table is buffered in memory with several transient
copies (text, bytes, gzip), so this suits small and medium tables only.

Password: pass --password-cmd to run a secret-store command at backup time, otherwise
libpq reads ~/.pgpass (preferred). The password is never on argv, but it is set in this
process's environment and so is visible to psql and gpg.
Recipient: pass --recipient, otherwise gpg uses `default-recipient` from ~/.gnupg/gpg.conf.

Exit codes: 0 success, 1 psql or gpg failed, 2 usage error or tool missing,
3 password command failed or printed nothing.
"""

import argparse
import datetime as dt
import gzip
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from shgit import Sh
from install import add_install_options, install

IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_$]*")


def quote_table(name: str) -> str:
    """Return `name` ([schema.]table, plain identifiers only) with each part double-quoted.

    The regex is the injection guard. Quoting makes the match case-sensitive, so a table
    created unquoted as Stocks (stored as stocks) must be passed as stocks.
    """
    parts = name.split(".")
    if not 1 <= len(parts) <= 2 or not all(IDENT.fullmatch(p) for p in parts):
        raise ValueError(f"invalid table name: {name!r}")
    return ".".join('"' + p + '"' for p in parts)


def utf8_exact_runner(args, capture_output, check, cwd, input, timeout=None):
    """shgit runner that decodes UTF-8 without newline translation.

    shgit's default runner uses text mode, which rewrites \\r\\n and lone \\r to \\n. CSV
    fields may contain those characters, so a backup made that way would alter data.
    """
    done = subprocess.run(
        args, capture_output=capture_output, cwd=cwd, timeout=timeout, shell=False,
        input=None if input is None else input.encode("utf-8"),
    )
    out = done.stdout.decode("utf-8") if done.stdout is not None else None
    err = done.stderr.decode("utf-8", "replace") if done.stderr is not None else None
    result = subprocess.CompletedProcess(args, done.returncode, out, err)
    if check:
        result.check_returncode()
    return result


def binary_runner(args, capture_output, check, cwd, input, timeout=None):
    """Carry arbitrary gzip bytes through shgit's text input interface."""
    done = subprocess.run(args, capture_output=capture_output, cwd=cwd, timeout=timeout,
                          input=None if input is None else input.encode("latin-1"))
    result = subprocess.CompletedProcess(args, done.returncode,
        done.stdout.decode("latin-1") if done.stdout is not None else None,
        done.stderr.decode("utf-8", "replace") if done.stderr is not None else None)
    if check:
        result.check_returncode()
    return result


def parse_args(argv: list[str]) -> tuple[argparse.Namespace, argparse.ArgumentParser]:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--host")
    p.add_argument("--port")
    p.add_argument("--db")
    p.add_argument("--user")
    p.add_argument("--table")
    p.add_argument("--outdir", type=Path)
    p.add_argument("--recipient", help="GPG key id, fingerprint, or email; default: gpg.conf default-recipient")
    p.add_argument("--password-cmd", help="command whose stdout is the DB password (default: ~/.pgpass)")
    add_install_options(p)
    args = p.parse_args(argv)
    if args.install:
        if any(getattr(args, name) is not None for name in
               ("host", "port", "db", "user", "table", "outdir", "recipient", "password_cmd")):
            p.error("backup arguments must follow -- when installing")
    else:
        if args.schedule is not None or args.log is not None or args.dry or args.create_key or args.public_key_out:
            p.error("installation options require --install")
        missing = [f"--{name}" for name in ("host", "db", "user", "table", "outdir")
                   if getattr(args, name) is None]
        if missing:
            p.error(f"the following arguments are required: {', '.join(missing)}")
        if args.backup_args:
            p.error("unexpected arguments: " + " ".join(args.backup_args))
        args.port = args.port or "5432"
    return args, p


def fetch_password(cmd: str) -> str:
    return Sh("sh", runner=utf8_exact_runner)["-c"](cmd).stdout.rstrip("\r\n")


def run(argv: list[str]) -> int:
    args, parser = parse_args(argv)
    if args.install:
        return install(args, parser)
    return backup(args)


def backup(args: argparse.Namespace) -> int:
    for tool in ("psql", "gpg"):
        if shutil.which(tool) is None:
            print(f"error: {tool} not found on PATH", file=sys.stderr)
            return 2
    try:
        table = quote_table(args.table)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.password_cmd:
        try:
            password = fetch_password(args.password_cmd)
        except (subprocess.CalledProcessError, OSError) as e:
            print(f"error: password command failed: {e}", file=sys.stderr)
            return 3
        if not password:
            print("error: password command printed nothing", file=sys.stderr)
            return 3
        os.environ["PGPASSWORD"] = password
    os.environ["PGCLIENTENCODING"] = "UTF8"  # output is decoded as UTF-8

    psql = Sh(runner=utf8_exact_runner).psql["-X"]["-q"]
    sql = f"COPY (SELECT * FROM {table}) TO STDOUT WITH (FORMAT csv, HEADER true)"
    try:
        csv_text = psql("-c", sql, no_password=True, host=args.host, port=args.port,
                        username=args.user, dbname=args.db, set="ON_ERROR_STOP=1").stdout
    except subprocess.CalledProcessError as e:
        print(f"error: psql exit {e.returncode}: {(e.stderr or '').strip()}", file=sys.stderr)
        return 1

    # --trust-model always: a public key imported from a file has no validity, and gpg
    # refuses to encrypt to it in batch mode. Import only keys you trust onto this host.
    gpg_cmd = (Sh(runner=binary_runner).gpg["--batch"]["--yes"]["--no-tty"]
               ["--trust-model"]["always"]["--encrypt"])
    if args.recipient:
        gpg_cmd = gpg_cmd["--recipient"][args.recipient]

    os.umask(0o077)  # Restrict access to backup files and new directories.
    args.outdir.mkdir(parents=True, exist_ok=True)
    stamp = dt.date.today().strftime("%Y%m%d")
    final = args.outdir / f"{args.table}-{stamp}.csv.gz.gpg"
    fd, partial_name = tempfile.mkstemp(prefix=f".{final.name}.", suffix=".partial", dir=args.outdir)
    os.close(fd)
    partial = Path(partial_name)
    try:
        try:
            gpg_cmd["--output"][str(partial)](
                input=gzip.compress(csv_text.encode("utf-8")).decode("latin-1")
            ).stdout
        except subprocess.CalledProcessError as e:
            print(f"error: gpg exit {e.returncode}: {(e.stderr or '').strip()}", file=sys.stderr)
            return 1
        os.replace(partial, final)
    finally:
        partial.unlink(missing_ok=True)
    print(f"wrote {final}")
    return 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1:]))
