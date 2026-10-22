#!/usr/bin/env bash
# Loads NHTSA vPIC (standalone PostgreSQL backup) into schema "vpic".
# Uses a cached zip in $DATA_DIR when one exists, otherwise downloads the current release.
set -euo pipefail
DATA_DIR=${DATA_DIR:-/data}
BASE=https://vpic.nhtsa.dot.gov

zip=$(ls "$DATA_DIR"/vPICList_lite_*.custom.zip 2>/dev/null | sort | tail -1 || true)
if [ -z "$zip" ]; then
  rel=$(curl -fsS "$BASE/downloads/" | grep -oE '/downloads/vPICList_lite_[0-9_]+\.custom\.zip' | head -1)
  [ -n "$rel" ] || { echo "no vPIC custom backup link found at $BASE/downloads/" >&2; exit 1; }
  zip="$DATA_DIR/$(basename "$rel")"
  echo "download $BASE$rel"
  curl -fL --retry 3 -o "$zip.part" "$BASE$rel"
  mv "$zip.part" "$zip"
else
  echo "cached $zip"
fi

backup="${zip%.custom.zip}.backup"
[ -f "$backup" ] || unzip -o -q "$zip" -d "$DATA_DIR"
[ -f "$backup" ] || { echo "expected $backup inside $zip" >&2; exit 1; }

psql -X -q -v ON_ERROR_STOP=1 -c "drop schema if exists vpic cascade"
pg_restore --single-transaction --no-owner --no-privileges -d "$PGDATABASE" "$backup"
psql -X -q -tA -c "select 'vpic tables: ' || count(*) from information_schema.tables where table_schema = 'vpic'"
