#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-routlis}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-routlis_postgres_data}"
STORAGE_VOLUME="${STORAGE_VOLUME:-routlis_storage}"
BACKUP_DIR="${BACKUP_DIR:-/opt/routlis/backups}"
COMMAND="${1:-deploy}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
KEEP_BACKUPS="${KEEP_BACKUPS:-3}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Set ENV_FILE to the VPS config path, for example /opt/routlis/.env, or create a local .env for development." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

inspect_volume() {
  local volume_name="$1"
  if docker volume inspect "$volume_name" >/dev/null 2>&1; then
    docker volume inspect "$volume_name" --format '{{.Name}} -> {{.Mountpoint}}'
  else
    echo "Missing Docker volume: $volume_name" >&2
    return 1
  fi
}

preflight() {
  inspect_volume "$POSTGRES_VOLUME"
  inspect_volume "$STORAGE_VOLUME"
}

backup() {
  mkdir -p "$BACKUP_DIR"

  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  local backup_root="$BACKUP_DIR/$stamp"
  mkdir -p "$backup_root"

  local db_name="${POSTGRES_DB:-routlis}"
  local db_user="${POSTGRES_USER:-routlis}"

  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T postgres \
    pg_dump -U "$db_user" -d "$db_name" -Fc > "$backup_root/postgres.dump"

  local storage_mountpoint
  storage_mountpoint="$(docker volume inspect "$STORAGE_VOLUME" --format '{{.Mountpoint}}')"
  tar -czf "$backup_root/storage.tar.gz" -C "$storage_mountpoint" .

  printf '%s\n' "$backup_root"
}

verify_deploy() {
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" ps --status running >/dev/null
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T backend node -e \
    "fetch('http://127.0.0.1:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
}

run_migrations() {
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" run --rm --no-deps --build backend npm run prisma:deploy
}

prune_safe_docker() {
  docker container prune -f
  docker image prune -af
  docker builder prune -af
  docker network prune -f
}

cleanup_backups() {
  if [[ ! -d "$BACKUP_DIR" ]]; then
    return 0
  fi

  mapfile -t backup_dirs < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
  local total="${#backup_dirs[@]}"
  if (( total <= KEEP_BACKUPS )); then
    return 0
  fi

  local keep_from=$((total - KEEP_BACKUPS))
  for ((i = 0; i < keep_from; i++)); do
    rm -rf "${backup_dirs[$i]}"
  done
}

cleanup_vps() {
  prune_safe_docker
  cleanup_backups
}

rollback() {
  local backup_root="${1:-}"
  mkdir -p "$BACKUP_DIR"
  if [[ -z "$backup_root" ]]; then
    backup_root="$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
  fi

  if [[ -z "$backup_root" || ! -d "$backup_root" ]]; then
    echo "No backup found to rollback from" >&2
    exit 1
  fi

  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down

  local storage_mountpoint
  storage_mountpoint="$(docker volume inspect "$STORAGE_VOLUME" --format '{{.Mountpoint}}')"

  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d postgres
  sleep 5
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T postgres \
    pg_restore -U "${POSTGRES_USER:-routlis}" -d "${POSTGRES_DB:-routlis}" --clean --if-exists < "$backup_root/postgres.dump"

  rm -rf "$storage_mountpoint"/*
  tar -xzf "$backup_root/storage.tar.gz" -C "$storage_mountpoint"

  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build backend frontend
}

deploy() {
  preflight
  local backup_root
  if [[ "$SKIP_BACKUP" == "1" ]]; then
    backup_root="${BACKUP_ROOT:-}"
  else
    backup_root="$(backup)"
  fi
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d postgres
  run_migrations
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build backend frontend
  verify_deploy || {
    echo "Deploy verification failed, rolling back from $backup_root" >&2
    rollback "$backup_root"
    exit 1
  }
}

seed() {
  if [[ "${ALLOW_PROD_SEED:-0}" != "1" && "${NODE_ENV:-}" == "production" ]]; then
    echo "Seed is blocked in production unless ALLOW_PROD_SEED=1 is set explicitly" >&2
    exit 1
  fi
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T backend npm run prisma:seed
}

case "$COMMAND" in
  deploy)
    deploy
    ;;
  seed)
    seed
    ;;
  prune)
    prune_safe_docker
    ;;
  cleanup)
    cleanup_vps
    ;;
  preflight)
    preflight
    ;;
  backup)
    backup
    ;;
  verify)
    verify_deploy
    ;;
  rollback)
    rollback "${2:-}"
    ;;
  *)
    echo "Usage: $(basename "$0") [deploy|seed|prune|cleanup|preflight|backup|verify|rollback [backup_dir]]" >&2
    exit 1
    ;;
esac
