#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
DOCKER_CMD="docker"

echo "==> Routlis local bootstrap"
echo "Proyecto: $ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no esta instalado o no esta disponible en PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
  else
    echo "Docker existe, pero el usuario actual no puede usarlo directamente."
    echo "Agrega tu usuario al grupo docker o ejecuta este script con privilegios."
    exit 1
  fi
fi

cd "$ROOT_DIR"

echo "==> Levantando PostgreSQL local con Docker Compose"
$DOCKER_CMD compose up -d postgres

echo "==> Esperando a que PostgreSQL acepte conexiones"
for _ in $(seq 1 30); do
  if $DOCKER_CMD compose exec -T postgres pg_isready -U "${POSTGRES_USER:-routlis}" -d "${POSTGRES_DB:-routlis}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! $DOCKER_CMD compose exec -T postgres pg_isready -U "${POSTGRES_USER:-routlis}" -d "${POSTGRES_DB:-routlis}" >/dev/null 2>&1; then
  echo "PostgreSQL no quedo listo a tiempo."
  exit 1
fi

echo "==> Instalando dependencias del backend"
cd "$BACKEND_DIR"
npm install

echo "==> Generando cliente Prisma"
npm run prisma:generate

echo "==> Aplicando migraciones"
npm run prisma:deploy

echo "==> Ejecutando seed demo"
npm run prisma:seed

cat <<'EOF'

Bootstrap local completado.

Siguientes pasos recomendados:

1. Backend:
   cd backend && npm run start:dev

2. Frontend:
   cd frontend && npm install && npm run dev

3. Acceso:
   http://localhost:3000/login

Credenciales demo:
   admin@routlis.local
   Admin123*
EOF
