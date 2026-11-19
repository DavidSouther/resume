# HW8: Daily encrypted table backup

`backup.py` (built on [shgit](https://github.com/davidsouther/shgit)) exports one Postgres table as CSV, gzips it, and encrypts it with a GPG public key. Output is `<outdir>/<table>-YYYYMMDD.csv.gz.gpg`. The export uses `psql COPY (SELECT * FROM t) TO STDOUT WITH (FORMAT csv, HEADER true)`, so no database-specific dump format is involved. `backup.py --install` adds a daily crontab entry.

## Prerequisites

- `psql` (Postgres client) on PATH for backups and cron installation. Key creation does not require it.
- `gpg` and `uv` on PATH. `backup.py` is a uv script with a `#!/usr/bin/env -S uv run --script` shebang. uv installs shgit (pinned to a commit, from GitHub) and its dependency structlog on first run and caches them, so the first run needs network access. Run `backup.py` once by hand against a real database before relying on cron.

## 1. Key pair (do this on a machine that is not the backup host)

Before taking the key machine offline, install `uv` and run `uv run --script backup.py --help` there to cache the script's dependencies. Copy both `backup.py` and `install.py` to that machine. The key-creation command prints the new key's fingerprint; record it for recipient selection.

```sh
./backup.py --install --create-key "Backup <you@example.com>" \
  --public-key-out backup-public.asc
```

Copy only `backup-public.asc` to the backup host and import it there. Keep the private key (and a revocation certificate) offline. The key is generated without an expiry on purpose: gpg refuses to encrypt to an expired key, which would stop nightly backups. Keeping the private key off the backup host prevents that key from being stolen with the host.

```sh
gpg --import backup-public.asc
```

## 2. Recipient selection

Either pass `--recipient <fingerprint>` (explicit, shown in the crontab line), or add a default to `~/.gnupg/gpg.conf` and omit the flag:

```
default-recipient 0xYOURFINGERPRINT
```

The script passes `--trust-model always` because a key imported from a file is otherwise "unknown" and gpg refuses to encrypt in batch mode. Import only keys you trust onto the backup host.

## 3. Password

Default is libpq's `~/.pgpass` (`chmod 600`), one line `host:port:db:user:password`. No password reaches argv.

To use a secret store instead, pass `--password-cmd`; its stdout becomes `PGPASSWORD` in the script's environment, so psql and gpg inherit it. It is never on argv. An empty result is an error (exit 3). macOS Keychain example:

Store the password once (this prompts for it):

```sh
security add-generic-password -a me -s pgbackup -w
```

Then add this flag to the backup arguments:

```
--password-cmd 'security find-generic-password -s pgbackup -w'
```

Pick a store that works non-interactively under cron. Session-based CLIs such as `bw` need an unlocked session and do not.

## 4. Install the cron job

```sh
./backup.py --install -- --host db.example.com --db hw --user me --table stocks \
  --outdir "$HOME/backups" --recipient 0xYOURFINGERPRINT
```

Options before `--`: `--schedule "M H * * *"` (default `17 2 * * *`, daily at 02:17), `--log FILE` (default `~/pgbackup.log`), `--print` (show the line only). The resulting crontab line looks like:

```
17 2 * * * PATH=/opt/homebrew/bin:/usr/bin:/bin /path/to/backup.py --host db.example.com --db hw --user me --table stocks --outdir /home/me/backups --recipient 0xYOURFINGERPRINT >> /home/me/pgbackup.log 2>&1 # pgbackup-hw8
```

One backup job is kept per crontab. Re-running replaces the line marked `# pgbackup-hw8`, even one for a different table, and leaves other entries alone. `%` in arguments is escaped for cron; newlines in the schedule, log path, or arguments are rejected. Output goes to the log file, so a failure produces no cron mail: check the log, and the newest file in the output directory.

Each run writes `<table>-YYYYMMDD.csv.gz.gpg`. A second run on the same day replaces it, and nothing prunes old files, so delete old backups yourself. On macOS, cron may need Full Disk Access for `/usr/sbin/cron`.

## Restore and verify

```sh
gpg --decrypt stocks-20261118.csv.gz.gpg | gunzip | head
```

## Test

```sh
uv run --script test_backup.py
```

The test fakes `psql` and generates a throwaway GPG key in a temporary `GNUPGHOME`. It checks that output decrypts, gunzips, and parses as the expected CSV; that CRLF inside fields is preserved; mode 0600; that the password is absent from argv; that psql and gpg failures leave no file; exit codes for a missing `psql` and a failing or empty password command; table-name rejection; and the installer (idempotence, other entries kept, `%` escaping, no existing crontab).

## Limits

The `psql` output is held in memory, gzipped in memory, and passed to gpg through shgit using a binary-safe runner. No plaintext touches disk, but a table must fit in memory. Data is requested as UTF-8 (`PGCLIENTENCODING`).

The backup was also run against the HW5 PostgreSQL database's `vpic.fueltype` table. Its decrypted and decompressed output matched a direct PostgreSQL CSV export byte for byte. This check used the `psql` client inside the database container because the host has no `psql` installed.
