#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Leov3/Routlist.git}"
BRANCH="${BRANCH:-principal}"
INSTALL_DIR="${INSTALL_DIR:-/opt/routlis/app}"
ENV_DIR="${ENV_DIR:-/opt/routlis}"
ENV_FILE="${ENV_FILE:-$ENV_DIR/.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-routlis}"
RUN_SEED="${RUN_SEED:-1}"
NONINTERACTIVE="${NONINTERACTIVE:-0}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"
UNTRUSTED_PROXY="${UNTRUSTED_PROXY:-0}"

frontend_host="${FRONTEND_HOST:-}"
api_host="${API_HOST:-}"
le_email="${LETSENCRYPT_EMAIL:-}"
postgres_password="${POSTGRES_PASSWORD:-}"
jwt_secret="${JWT_SECRET:-}"
integration_key="${INTEGRATION_ENCRYPTION_KEY:-}"
seed_password="${SEED_ADMIN_PASSWORD:-Admin123*}"

usage() {
  cat <<'EOF'
Usage:
  curl -fsSL https://raw.githubusercontent.com/Leov3/Routlist/principal/scripts/install-vps.sh | bash

Optional env vars:
  REPO_URL, BRANCH, INSTALL_DIR, ENV_DIR, ENV_FILE, COMPOSE_PROJECT_NAME
  FRONTEND_HOST, API_HOST, LETSENCRYPT_EMAIL, POSTGRES_PASSWORD
  JWT_SECRET, INTEGRATION_ENCRYPTION_KEY, SEED_ADMIN_PASSWORD
  NONINTERACTIVE=1
  RUN_SEED=0
  INSTALL_DOCKER=0
  --frontend-host, --api-host, --email, --postgres-password, --jwt-secret
  --integration-key, --seed-password, --install-dir, --env-file, --repo-url
  --branch, --run-seed, --no-seed, --no-docker, --no-prompt
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

is_tty() {
  [[ -t 0 && -t 1 ]]
}

prompt() {
  local var_name="$1"
  local message="$2"
  local default_value="${3:-}"
  local value="${!var_name:-}"

  if [[ -n "$value" ]]; then
    printf -v "$var_name" '%s' "$value"
    return
  fi

  if [[ "$NONINTERACTIVE" == "1" ]]; then
    if [[ -n "$default_value" ]]; then
      printf -v "$var_name" '%s' "$default_value"
      return
    fi
    echo "Missing required value: $var_name" >&2
    exit 1
  fi

  if is_tty; then
    if [[ -n "$default_value" ]]; then
      read -r -p "$message [$default_value]: " value
      value="${value:-$default_value}"
    else
      read -r -p "$message: " value
    fi
    printf -v "$var_name" '%s' "$value"
    return
  fi

  if [[ -n "$default_value" ]]; then
    printf -v "$var_name" '%s' "$default_value"
    return
  fi

  echo "Cannot prompt for $var_name without a TTY." >&2
  exit 1
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
  else
    echo "openssl or python3 is required to generate secrets" >&2
    exit 1
  fi
}

ensure_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "This installer must run as root or with sudo." >&2
    exit 1
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --frontend-host) frontend_host="${2:-}"; shift 2 ;;
      --api-host) api_host="${2:-}"; shift 2 ;;
      --email|--letsencrypt-email) le_email="${2:-}"; shift 2 ;;
      --postgres-password) postgres_password="${2:-}"; shift 2 ;;
      --jwt-secret) jwt_secret="${2:-}"; shift 2 ;;
      --integration-key) integration_key="${2:-}"; shift 2 ;;
      --seed-password) seed_password="${2:-}"; shift 2 ;;
      --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
      --env-dir) ENV_DIR="${2:-}"; shift 2 ;;
      --env-file) ENV_FILE="${2:-}"; shift 2 ;;
      --repo-url) REPO_URL="${2:-}"; shift 2 ;;
      --branch) BRANCH="${2:-}"; shift 2 ;;
      --run-seed) RUN_SEED="${2:-1}"; shift 2 ;;
      --no-seed) RUN_SEED=0; shift ;;
      --no-docker) INSTALL_DOCKER=0; shift ;;
      --no-prompt) NONINTERACTIVE=1; shift ;;
      -h|--help) usage; exit 0 ;;
      --) shift; break ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 1
        ;;
    esac
  done
}

detect_os() {
  if [[ ! -r /etc/os-release ]]; then
    echo "Cannot detect operating system." >&2
    exit 1
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  if [[ "${ID:-}" != "debian" && "${ID_LIKE:-}" != *"debian"* && "${ID:-}" != "ubuntu" ]]; then
    echo "This installer currently supports Debian/Ubuntu hosts only." >&2
    exit 1
  fi
}

install_docker_debian() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  if [[ "$INSTALL_DOCKER" != "1" ]]; then
    echo "Docker is missing. Set INSTALL_DOCKER=1 to auto-install it." >&2
    exit 1
  fi

  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} \
    ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

normalize_host() {
  local raw="${1:-}"
  raw="${raw#http://}"
  raw="${raw#https://}"
  raw="${raw%/}"
  printf '%s' "$raw"
}

ensure_docker() {
  require_cmd docker
  docker compose version >/dev/null 2>&1 || {
    echo "docker compose plugin is required." >&2
    exit 1
  }
}

main() {
  parse_args "$@"
  ensure_root
  detect_os
  install_docker_debian
  ensure_docker
  require_cmd git

  frontend_host="$(normalize_host "$frontend_host")"
  api_host="$(normalize_host "$api_host")"

  prompt frontend_host "Frontend host" "${frontend_host:-}"
  prompt api_host "API host" "${api_host:-}"
  prompt le_email "Let's Encrypt email" "${le_email:-}"
  prompt postgres_password "PostgreSQL password" "${postgres_password:-}"
  prompt jwt_secret "JWT secret" "${jwt_secret:-}"
  prompt integration_key "Integration encryption key" "${integration_key:-}"
  prompt seed_password "Seed admin password" "${seed_password:-}"

  if [[ -z "$postgres_password" ]]; then
    postgres_password="$(generate_secret)"
  fi
  if [[ -z "$jwt_secret" ]]; then
    jwt_secret="$(generate_secret)"
  fi
  if [[ -z "$integration_key" ]]; then
    integration_key="$(generate_secret)"
  fi

  frontend_host="$(normalize_host "$frontend_host")"
  api_host="$(normalize_host "$api_host")"

  install_dir_parent="$(dirname "$INSTALL_DIR")"
  mkdir -p "$install_dir_parent"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    git -C "$INSTALL_DIR" fetch --all --prune
    git -C "$INSTALL_DIR" checkout "$BRANCH"
    git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
  else
    rm -rf "$INSTALL_DIR"
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR"
  fi

  mkdir -p "$ENV_DIR"
  cat > "$ENV_FILE" <<EOF
FRONTEND_HOST=$frontend_host
API_HOST=$api_host
LETSENCRYPT_EMAIL=$le_email

POSTGRES_DB=routlis
POSTGRES_USER=routlis
POSTGRES_PASSWORD=$postgres_password

JWT_SECRET=$jwt_secret
JWT_EXPIRES_IN=1d
INTEGRATION_ENCRYPTION_KEY=$integration_key
COOKIE_NAME=routlis_token
COOKIE_SECURE=true
FRONTEND_URL=https://$frontend_host
CORS_ORIGINS=https://$frontend_host,https://$api_host
PUBLIC_AUDIO_BASE_URL=https://$api_host/files/audio-assets
LOCAL_BACKUP_PATH=/var/www/routlis/storage/backups
NEXT_PUBLIC_API_URL=https://$api_host
NEXT_PUBLIC_MEDIA_URL=https://$api_host
SEED_ADMIN_PASSWORD=$seed_password
EOF

  cd "$INSTALL_DIR"
  ENV_FILE="$ENV_FILE" COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" bash scripts/deploy-vps.sh deploy

  if [[ "$RUN_SEED" == "1" ]]; then
    ENV_FILE="$ENV_FILE" COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME" bash scripts/deploy-vps.sh seed || true
  fi

  cat <<EOF

Routlis installed successfully.

Frontend: https://$frontend_host
API:      https://$api_host
Env file:  $ENV_FILE
Repo:      $INSTALL_DIR
EOF
}

main "$@"
