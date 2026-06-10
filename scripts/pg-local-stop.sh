#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/pg-local-env.sh"
"$PGBIN/pg_ctl" -D "$PGDATA" stop
