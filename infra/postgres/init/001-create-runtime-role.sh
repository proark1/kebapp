#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER fehlt}"
: "${POSTGRES_DB:?POSTGRES_DB fehlt}"
: "${POSTGRES_TEST_DB:?POSTGRES_TEST_DB fehlt}"
: "${POSTGRES_APP_USER:?POSTGRES_APP_USER fehlt}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD fehlt}"

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_user="$POSTGRES_APP_USER" \
  --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)
\gexec
SQL

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname postgres \
  --set=test_db="$POSTGRES_TEST_DB" \
  --set=owner_user="$POSTGRES_USER" <<'SQL'
SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'test_db',
  :'owner_user'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'test_db'
)
\gexec
SQL

for database in "$POSTGRES_DB" "$POSTGRES_TEST_DB"; do
  psql \
    --set=ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$database" \
    --set=app_user="$POSTGRES_APP_USER" <<'SQL'
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user')
\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')
\gexec
SELECT format(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I',
  :'app_user'
)
\gexec
SELECT format(
  'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I',
  :'app_user'
)
\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'app_user'
)
\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
  :'app_user'
)
\gexec
SQL
done
