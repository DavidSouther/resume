#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""End-to-end tests of backup.py and install.py against a fake psql and a throwaway GPG key.

Covers the decrypt/gunzip/CSV round trip, file mode 0600, password kept off argv, CRLF
preservation, failure cleanup, exit codes, and crontab installation."""

import csv
import gzip
import io
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).parent
BACKUP = HERE / "backup.py"

FAKE_PSQL = """#!/bin/sh
# Record argv and the password env, then emit CSV like COPY ... FORMAT csv would.
printf '%s\\n' "$@" > "$FAKE_LOG"
printf '%s' "$PGPASSWORD" > "$FAKE_LOG.pw"
[ -n "$FAKE_FAIL" ] && exit 1
[ -n "$FAKE_CRLF" ] && { printf 'id,note\\r\\n1,"a\\r\\nb\\rc"\\r\\n'; exit 0; }
printf 'id,name\\n1,"Smith, Jane"\\n2,Bob\\n'
"""


class BackupTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix="bk")
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        self.bin = self.tmp / "bin"
        self.bin.mkdir()
        psql = self.bin / "psql"
        psql.write_text(FAKE_PSQL)
        psql.chmod(0o755)
        self.home = self.tmp / "g"
        self.home.mkdir(mode=0o700)
        self.out = self.tmp / "out"
        self.env = {
            **os.environ,
            "GNUPGHOME": str(self.home),
            "PATH": f"{self.bin}:{os.environ['PATH']}",
            "FAKE_LOG": str(self.tmp / "psql.log"),
        }
        subprocess.run(
            ["gpg", "--batch", "--pinentry-mode", "loopback", "--passphrase", "",
             "--quick-gen-key", "backup@test.invalid", "default", "default", "never"],
            env=self.env, check=True, capture_output=True,
        )

    def tearDown(self):
        subprocess.run(["gpgconf", "--kill", "all"], env=self.env, capture_output=True)

    def backup(self, *extra, env=None):
        cmd = [str(BACKUP), "--host", "db.example", "--db", "hw", "--user", "u",
               "--table", "stocks", "--outdir", str(self.out), *extra]
        return subprocess.run(cmd, env=env or self.env, capture_output=True, text=True)

    def test_round_trip(self):
        r = self.backup("--recipient", "backup@test.invalid", "--password-cmd", "echo s3cret")
        self.assertEqual(r.returncode, 0, r.stderr)
        files = list(self.out.glob("stocks-*.csv.gz.gpg"))
        self.assertEqual(len(files), 1)
        self.assertEqual(oct(files[0].stat().st_mode & 0o777), "0o600")
        plain = subprocess.run(
            ["gpg", "--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--decrypt", str(files[0])],
            env=self.env, capture_output=True, check=True,
        ).stdout
        rows = list(csv.reader(io.StringIO(gzip.decompress(plain).decode())))
        self.assertEqual(rows, [["id", "name"], ["1", "Smith, Jane"], ["2", "Bob"]])
        argv = (self.tmp / "psql.log").read_text()
        self.assertIn("db.example", argv)
        self.assertIn("--host=db.example", argv)
        self.assertIn("--no-password", argv)
        self.assertNotIn("s3cret", argv)
        self.assertEqual((self.tmp / "psql.log.pw").read_text(), "s3cret")

    def decrypt(self, path):
        plain = subprocess.run(
            ["gpg", "--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--decrypt", str(path)],
            env=self.env, capture_output=True, check=True,
        ).stdout
        return gzip.decompress(plain)

    def test_raw_csv_not_on_disk(self):
        # Guards against raw CSV leaking; gzip-only output would not be caught by this check.
        r = self.backup("--recipient", "backup@test.invalid")
        self.assertEqual(r.returncode, 0, r.stderr)
        files = list(self.out.iterdir())
        self.assertEqual(len(files), 1)
        self.assertNotIn(b"Smith", files[0].read_bytes())

    def test_crlf_in_fields_preserved(self):
        r = self.backup("--recipient", "backup@test.invalid", env={**self.env, "FAKE_CRLF": "1"})
        self.assertEqual(r.returncode, 0, r.stderr)
        data = self.decrypt(next(self.out.iterdir()))
        self.assertEqual(data, b'id,note\r\n1,"a\r\nb\rc"\r\n')

    def test_gpg_failure_leaves_no_file(self):
        r = self.backup("--recipient", "nobody@test.invalid")
        self.assertEqual(r.returncode, 1)
        self.assertIn("gpg exit", r.stderr)
        self.assertEqual(list(self.out.glob("*")), [])

    def test_overlapping_runs_publish_complete_output(self):
        # Hold both fake encryptors open together before writing their output.
        fake_gpg = self.bin / "gpg"
        fake_gpg.write_text(f'''#!{sys.executable}
import os, pathlib, sys, time
barrier = pathlib.Path(os.environ["BARRIER"])
(barrier / str(os.getpid())).touch()
deadline = time.monotonic() + 15
while len(list(barrier.iterdir())) < 2:
    if time.monotonic() > deadline: sys.exit(1)
    time.sleep(0.01)
pathlib.Path(sys.argv[sys.argv.index("--output") + 1]).write_bytes(sys.stdin.buffer.read())
''')
        fake_gpg.chmod(0o755)
        barrier = self.tmp / "barrier"
        barrier.mkdir()
        env = {**self.env, "BARRIER": str(barrier)}
        command = [str(BACKUP), "--host", "h", "--db", "d", "--user", "u",
                   "--table", "stocks", "--outdir", str(self.out), "--recipient", "key"]
        processes = [subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                     for _ in range(2)]
        for process in processes:
            _, stderr = process.communicate(timeout=30)
            self.assertEqual(process.returncode, 0, stderr.decode())
        files = list(self.out.iterdir())
        self.assertEqual(len(files), 1)
        self.assertEqual(gzip.decompress(files[0].read_bytes()), b'id,name\n1,"Smith, Jane"\n2,Bob\n')

    def test_password_cmd_failure_and_empty(self):
        self.assertEqual(self.backup("--recipient", "backup@test.invalid", "--password-cmd", "false").returncode, 3)
        self.assertEqual(self.backup("--recipient", "backup@test.invalid", "--password-cmd", "true").returncode, 3)

    def test_missing_psql_errors(self):
        # Remove every directory holding a psql, including the fake one in self.bin.
        dirs = [p for p in os.environ["PATH"].split(os.pathsep) if not (Path(p) / "psql").exists()]
        env = {**self.env, "PATH": os.pathsep.join(dirs)}
        r = self.backup("--recipient", "backup@test.invalid", env=env)
        self.assertEqual(r.returncode, 2)
        self.assertIn("psql not found", r.stderr)

    def test_psql_failure_leaves_no_file(self):
        r = self.backup("--recipient", "backup@test.invalid", env={**self.env, "FAKE_FAIL": "1"})
        self.assertEqual(r.returncode, 1)
        self.assertEqual(list(self.out.glob("*")), [])

    def test_bad_table_rejected(self):
        for table in ("x; DROP TABLE y", "stocks\n"):
            with self.subTest(table=table):
                cmd = [str(BACKUP), "--host", "h", "--db", "d", "--user", "u",
                       "--table", table, "--outdir", str(self.out)]
                r = subprocess.run(cmd, env=self.env, capture_output=True, text=True)
                self.assertEqual(r.returncode, 2)


class InstallTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix="in")
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        for name, body in {
            "psql": "#!/bin/sh\n",
            "crontab": '#!/bin/sh\nif [ "$1" = "-l" ]; then cat "$FC" 2>/dev/null || { echo "no crontab for x" >&2; exit 1; }; else cat > "$FC"; fi\n',
        }.items():
            (self.tmp / name).write_text(body)
            (self.tmp / name).chmod(0o755)
        self.store = self.tmp / "store"
        self.env = {**os.environ, "PATH": f"{self.tmp}:{os.environ['PATH']}", "FC": str(self.store)}

    def install(self, *extra):
        return subprocess.run([str(BACKUP), "--install", "--", "--host", "h", "--db", "d", "--user", "u",
                               "--table", "t", "--outdir", "/o dir", *extra],
                              env=self.env, capture_output=True, text=True)

    def test_help_shows_backup_and_install_options(self):
        result = subprocess.run([str(BACKUP), "--help"], env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        for option in ("--install", "--schedule", "--create-key", "--host"):
            self.assertIn(option, result.stdout)

    def test_install_flags_are_parsed_before_separator(self):
        result = subprocess.run(
            [str(BACKUP), "--schedule", "5 4 * * *", "--install", "--print", "--log", "/tmp/log file",
             "--", "--host", "db", "--schedule", "backup-value"],
            env=self.env, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout.startswith("5 4 * * * PATH="))
        self.assertIn("'/tmp/log file'", result.stdout)
        self.assertIn("--schedule backup-value", result.stdout)

    def test_backup_options_require_separator_in_install_mode(self):
        result = subprocess.run([str(BACKUP), "--install", "--host", "db"],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("backup arguments must follow --", result.stderr)

    def test_idempotent_and_keeps_other_entries(self):
        self.store.write_text("0 0 * * * other\n")
        for _ in range(2):
            self.assertEqual(self.install().returncode, 0)
        lines = self.store.read_text().splitlines()
        self.assertEqual(lines[0], "0 0 * * * other")
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[1].startswith("17 2 * * * PATH="))
        self.assertIn("'/o dir'", lines[1])

    def test_works_with_no_existing_crontab(self):
        self.assertEqual(self.install().returncode, 0)
        self.assertEqual(len(self.store.read_text().splitlines()), 1)

    def test_percent_escaped_for_cron(self):
        self.assertEqual(self.install("--password-cmd", "date +%s").returncode, 0)
        self.assertIn("+\\%s", self.store.read_text())

    def test_newline_rejected(self):
        result = self.install("--password-cmd", "one\ntwo")
        self.assertEqual(result.returncode, 2)
        self.assertIn("newlines", result.stderr)

    def test_arguments_are_posix_shell_quoted(self):
        value = "a'b\tc"
        self.assertEqual(self.install("--password-cmd", value).returncode, 0)
        line = self.store.read_text().strip()
        command = line.split(" PATH=", 1)[1].split(" >> ", 1)[0]
        # Drop the PATH assignment and use /bin/sh to reconstruct the argument vector.
        command = command.split(" ", 1)[1]
        script, *args = subprocess.run(
            ["/bin/sh", "-c", "set -- " + command + '; printf "%s\\0" "$@"'],
            capture_output=True, check=True,
        ).stdout.decode().split("\0")[:-1]
        self.assertEqual(script, str(BACKUP))
        self.assertEqual(args[-2:], ["--password-cmd", value])

    def test_create_key_without_installing_cron(self):
        gpg = self.tmp / "gpg"
        gpg.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$KEY_LOG"\n'
                       'case "$1" in --status-fd) printf "[GNUPG:] KEY_CREATED B ABC123\\n";; '
                       '--export) printf "public key";; esac\n')
        gpg.chmod(0o755)
        public_key = self.tmp / "public.asc"
        result = subprocess.run(
            [str(BACKUP), "--install", "--create-key", "Backup <b@example.com>",
             "--public-key-out", str(public_key)],
            env={**self.env, "KEY_LOG": str(self.tmp / "key.log")}, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(public_key.read_text(), "public key")
        log = (self.tmp / "key.log").read_text()
        self.assertIn("--quick-gen-key Backup <b@example.com>", log)
        self.assertIn("--export --armor ABC123", log)
        self.assertIn("ABC123", result.stdout)
        self.assertFalse(self.store.exists())

    def test_existing_public_key_output_is_not_overwritten(self):
        public_key = self.tmp / "public.asc"
        public_key.write_text("existing")
        result = subprocess.run(
            [str(BACKUP), "--install", "--create-key", "Backup <b@example.com>",
             "--public-key-out", str(public_key)], env=self.env, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(public_key.read_text(), "existing")

    def test_key_export_failure_reports_recovery(self):
        gpg = self.tmp / "gpg"
        gpg.write_text('#!/bin/sh\ncase "$1" in --status-fd) printf "[GNUPG:] KEY_CREATED B ABC123\\n";; '
                       '--export) exit 1;; esac\n')
        gpg.chmod(0o755)
        public_key = self.tmp / "public.asc"
        result = subprocess.run(
            [str(BACKUP), "--install", "--create-key", "Backup <b@example.com>",
             "--public-key-out", str(public_key)], env=self.env, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertFalse(public_key.exists())
        self.assertIn("gpg --armor --export ABC123", result.stderr)


if __name__ == "__main__":
    unittest.main()
