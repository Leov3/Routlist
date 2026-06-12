# Variables y secretos para GitHub, VPS y despliegue historico

> Documento historico. La ruta activa de Routlis v1.1 usa la rama `principal`, Docker Compose y un proxy externo con Nginx Proxy Manager.

## Objetivo

Dejar a Routlis listo para la ruta historica de despliegue y dejar claramente separada la ruta activa de v1.1:

- desarrollo local
- despliegue automatico desde GitHub
- VPS con Docker Compose directo

## 1. Variables locales

Para correr en local con `docker compose`, usa la raiz del proyecto o adapta los ejemplos de `backend/.env.example` y `frontend/.env.example`.

Archivo recomendado:

```txt
.env
```

Contenido base:

```env
POSTGRES_DB=routlis
POSTGRES_USER=routlis
POSTGRES_PASSWORD=routlis

JWT_SECRET=change-me-in-development
JWT_EXPIRES_IN=1d
COOKIE_NAME=routlis_token
COOKIE_SECURE=false

FRONTEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001

NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_MEDIA_URL=http://localhost:4000

SEED_ADMIN_PASSWORD=Admin123*
```

## 2. Secretos de GitHub

Estos secretos se usan en el workflow de despliegue:

```txt
VPS_HOST
VPS_USER
VPS_APP_DIR
VPS_SSH_PRIVATE_KEY
VPS_COMPOSE_PROFILE
```

Valores esperados:

```txt
VPS_HOST=IP_O_DOMINIO_DEL_VPS
VPS_USER=usuario_ssh
VPS_APP_DIR=/opt/routlis/app
VPS_SSH_PRIVATE_KEY=clave_privada_ssh_completa
VPS_COMPOSE_PROFILE=prod
```

Si vas a usar el flujo historico con Easypanel:

```txt
VPS_COMPOSE_PROFILE=easypanel
```

## 3. Variables del VPS

Archivo recomendado:

```txt
/opt/routlis/.env
```

Si vas con el flujo historico con Easypanel:

```bash
cp deploy/easypanel.env.example /opt/routlis/.env
```

Contenido esperado:

```env
POSTGRES_DB=routlis
POSTGRES_USER=routlis
POSTGRES_PASSWORD=change-me

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
COOKIE_NAME=routlis_token

FRONTEND_URL=https://routlis.tudominio.com
CORS_ORIGINS=https://routlis.tudominio.com
PUBLIC_AUDIO_BASE_URL=https://api.routlis.tudominio.com/files/audio-assets

NEXT_PUBLIC_API_URL=https://api.routlis.tudominio.com
NEXT_PUBLIC_MEDIA_URL=https://api.routlis.tudominio.com

SEED_ADMIN_PASSWORD=Admin123*
```

Si vas con el flujo historico con Traefik propio:

```env
POSTGRES_DB=routlis
POSTGRES_USER=routlis
POSTGRES_PASSWORD=change-me

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
COOKIE_NAME=routlis_token
SEED_ADMIN_PASSWORD=Admin123*

LETSENCRYPT_EMAIL=you@example.com
FRONTEND_HOST=routlis.tudominio.com
API_HOST=api.routlis.tudominio.com
```

## 4. Recomendaciones

- `VPS_SSH_PRIVATE_KEY` debe ser la clave privada sin passphrase, o una clave con agente SSH funcional en GitHub Actions.
- `VPS_APP_DIR` debe apuntar al clon del repo en el VPS.
- No subas `.env` real al repositorio.
- `SEED_ADMIN_PASSWORD` solo debe usarse para bootstrap inicial o reseed manual.
- En producción, `COOKIE_SECURE` debe ser `true`.

## 5. Resumen rapido

### GitHub Secrets

```txt
VPS_HOST
VPS_USER
VPS_APP_DIR
VPS_SSH_PRIVATE_KEY
VPS_COMPOSE_PROFILE
```

### VPS / flujo historico

```txt
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
JWT_SECRET
JWT_EXPIRES_IN
COOKIE_NAME
FRONTEND_URL
CORS_ORIGINS
PUBLIC_AUDIO_BASE_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_MEDIA_URL
SEED_ADMIN_PASSWORD
```

## 6. Checklist corto

La lista operativa de 10 minutos esta en:

```txt
documentos/checklist_despliegue_10_min_routlis_v1.md
```
