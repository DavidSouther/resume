#!/usr/bin/env bash
# Applies migrations/NNN_*.sql and NNN_*.sh in name order, once each.
# Applied names and checksums are recorded in schema_migrations, which 000 creates.
set -euo pipefail
cd "$(dirname "$0")"

until pg_isready -q; do sleep 1; done
sql() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

for f in [0-9][0-9][0-9]_*.sql [0-9][0-9][0-9]_*.sh; do
  [ -e "$f" ] || continue
  sum=$(sha256sum "$f" | cut -d' ' -f1)
  if [ "$(sql -tAc "select to_regclass('public.schema_migrations') is not null")" = t ]; then
    applied=$(sql -tAc "select checksum from schema_migrations where name = '$f'")
    if [ -n "$applied" ]; then
      [ "$applied" = "$sum" ] || echo "warning: $f changed since it was applied" >&2
      echo "skip   $f"
      continue
    fi
  fi
  echo "apply  $f"
  case "$f" in
    *.sql) sql -1 -f "$f" ;;
    *.sh) DATA_DIR=/data bash "$f" ;;
  esac
  sql -c "insert into schema_migrations (name, checksum) values ('$f', '$sum')"
done
