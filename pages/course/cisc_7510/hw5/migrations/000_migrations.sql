-- Bookkeeping for run.sh. The runner records each applied file here after it succeeds.
create table if not exists schema_migrations (
  name       text primary key,
  checksum   text not null,
  applied_at timestamptz not null default now()
);
