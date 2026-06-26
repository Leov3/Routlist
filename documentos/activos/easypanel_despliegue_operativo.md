# Routlis en Easypanel: guia operativa

Este documento resume la configuracion real que quedo funcionando para Routlis en Easypanel y los problemas que se resolvieron durante el despliegue.

## Estado final

- `routlis.adminpage.space` publica el frontend.
- `api.adminpage.space` publica el backend.
- Easypanel queda en `:3000`.
- El backend no expone el puerto `4000` al host.
- Postgres no queda expuesto publicamente.
- El TLS publico es emitido por Let's Encrypt a traves de Traefik de Easypanel.

## Arquitectura usada

- Proyecto Easypanel: `desarrollo`
- App frontend: `routlis-frontend`
- App backend: `routlis-backend`
- Base de datos: `routlis-postgres`
- Repo GitHub: `Leov3/Routlist`
- Rama de despliegue: `easypanel`

## Dominios

- Frontend: `routlis.adminpage.space`
- Backend: `api.adminpage.space`
- Panel de Easypanel: `panel.adminpage.space` si se usa subdominio dedicado

## Variables de entorno del backend

Usar este bloque en el servicio backend de Easypanel:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://routlis:routlis@routlis-postgres:5432/routlis?schema=public
JWT_SECRET=Qm7v9f3R2zK8pL1xN4sD6hT0wV5cJ9aB2eF7gH3m
JWT_EXPIRES_IN=1d
INTEGRATION_ENCRYPTION_KEY=K8nV4pZ1sT6xR3mQ9hD2cF7jL0wB5aN8yE4uP1t
COOKIE_NAME=routlis_token
COOKIE_SECURE=true
FRONTEND_URL=https://routlis.adminpage.space
CORS_ORIGINS=https://routlis.adminpage.space,https://*.adminpage.space
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/var/www/routlis/storage
LOCAL_AUDIO_PATH=/var/www/routlis/storage/audio-assets
LOCAL_BACKUP_PATH=/var/www/routlis/storage/backups
PUBLIC_AUDIO_BASE_URL=https://api.adminpage.space/files/audio-assets
SEED_ADMIN_PASSWORD=Admin123*
```

## Variables de entorno del frontend

Usar este bloque en el servicio frontend de Easypanel:

```env
NEXT_PUBLIC_API_URL=https://api.adminpage.space
NEXT_PUBLIC_MEDIA_URL=https://api.adminpage.space
```

## Configuracion de fuente en Easypanel

- Frontend:
  - GitHub
  - repo: `Leov3/Routlist`
  - rama: `easypanel`
  - ruta de compilacion: `frontend`
  - Dockerfile: `frontend/Dockerfile`
- Backend:
  - GitHub
  - repo: `Leov3/Routlist`
  - rama: `easypanel`
  - ruta de compilacion: `backend`
  - Dockerfile: `backend/Dockerfile`

## Orden correcto de despliegue

1. Crear `routlis-postgres`.
2. Crear `routlis-backend`.
3. Crear `routlis-frontend`.
4. Asignar dominios.
5. Hacer redeploy del backend.
6. Hacer redeploy del frontend.
7. Ejecutar seed inicial si la base de datos esta vacia.

## Seed inicial

El seed crea las cuentas demo y el owner inicial.

Credencial inicial confirmada:

- Email: `admin@routlis.local`
- Password: `Admin123*`

El seed se ejecuta dentro del backend con:

```bash
npm run prisma:seed
```

No debe correrse en cada despliegue automatico.

## Problemas que se resolvieron

### 1. El frontend quedaba congelado en `/board`

Causa:

- el bundle del frontend se habia compilado con el marcador `__AUTO__`
- eso hacia que el navegador intentara llamar al API por `:4000` en el host equivocado

Solucion:

- definir `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_MEDIA_URL` en el frontend
- forzar un rebuild real del frontend

### 2. `net::ERR_CONNECTION_TIMED_OUT` hacia `:4000`

Causa:

- el frontend estaba resolviendo el API al mismo host del navegador con puerto `4000`

Solucion:

- publicar el API en `https://api.adminpage.space`
- reconstruir el frontend con la URL correcta

### 3. `Invalid credentials`

Causa:

- la tabla `User` estaba vacia despues de recrear el entorno

Solucion:

- ejecutar el seed inicial en el backend

### 4. El panel o el sitio aparecian como "No seguro"

Causa:

- DNS y TLS aun no estaban alineados
- el dominio se estaba probando antes de tener certificado valido

Solucion:

- crear los registros `A` en DNS para `routlis`, `api` y `panel`
- dejar el proxy de Cloudflare en modo DNS only mientras se validaba
- permitir que Traefik emitiera certificados Let's Encrypt

### 5. El backend parecia publico por puerto

Causa aparente:

- la app estaba accesible por dominio, pero no por puerto directo

Resultado verificado:

- el servicio backend no expone `4000` al host
- la exposicion publica correcta es solo por `api.adminpage.space`

## SMTP

El correo de Routlis quedo funcionando con la configuracion persistida en la base de datos.

Datos verificados:

- `SystemMailSettings.enabled = true`
- proveedor SMTP: Gmail
- logs de correo con estado `SENT`

Si el correo no llega a la bandeja de entrada, revisar:

- spam/promociones
- reputacion del remitente
- filtros del destinatario

## Verificaciones utiles

```bash
curl -I https://api.adminpage.space/health
curl -I https://routlis.adminpage.space/login
```

En el backend local del host:

```bash
docker service inspect desarrollo_routlis-backend --format '{{json .Spec.EndpointSpec.Ports}}'
```

Debe devolver `null` para confirmar que no hay puerto publico directo.

## Regla operativa

- Solo redeployar desde GitHub en la rama `easypanel`.
- No usar `3000` para Routlis en el host, porque ese puerto lo usa Easypanel.
- No exponer Postgres ni puertos internos.
- No correr seed automatico en cada deploy.
