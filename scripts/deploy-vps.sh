#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-routlis}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/../.env}"
COMPOSE_PROFILE="${COMPOSE_PROFILE:-prod}"
if [[ "$COMPOSE_PROFILE" == "easypanel" ]]; then
  COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.easypanel.yml}"
else
  COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
fi
COMMAND="${1:-deploy}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

deploy() {
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T backend npm run prisma:deploy
}

seed() {
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T backend npm run prisma:seed
}

case "$COMMAND" in
  deploy)
    deploy
    ;;
  seed)
    seed
    ;;
  *)
    echo "Usage: $(basename "$0") [deploy|seed]" >&2
    exit 1
    ;;
esac
