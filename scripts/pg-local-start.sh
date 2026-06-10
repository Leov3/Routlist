#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/pg-local-env.sh"

if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  echo "PostgreSQL local ya esta corriendo en $PGHOST:$PGPORT"
  exit 0
fi

"$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/postgres.log" start
"$PGBIN/createdb" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" >/dev/null 2>&1 || true
echo "PostgreSQL local listo en $PGHOST:$PGPORT"
