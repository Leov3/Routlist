#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PGROOT="$ROOT_DIR/pgsql-local"
export PGBIN="$PGROOT/usr/lib/postgresql/17/bin"
export LD_LIBRARY_PATH="$PGROOT/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export PGDATA="$ROOT_DIR/.local-postgres"
export PGHOST="127.0.0.1"
export PGPORT="5432"
export PGUSER="routlis"
export PGDATABASE="routlis"
