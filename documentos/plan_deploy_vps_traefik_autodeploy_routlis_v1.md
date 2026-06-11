# Plan de despliegue en VPS con Traefik propio y auto-deploy desde `main`

## Objetivo

Desplegar Routlis en el VPS sin Easypanel, con acceso publico por web a traves de Traefik propio, y con actualizacion automatica cuando haya commits en la rama `main`.

## Arquitectura propuesta

- `traefik`: proxy inverso publico con TLS.
- `frontend`: Next.js.
- `backend`: NestJS.
- `postgres`: base de datos.
- `storage`: volumen persistente para audios e imagenes.

## Flujo objetivo

1. Haces merge o push a `main`.
2. GitHub dispara el despliegue automatizado.
3. El VPS hace `git pull` o recibe el build.
4. Se reconstruyen imagenes Docker.
5. Se reinician los contenedores.
6. Traefik sigue exponiendo los dominios publicos sin depender de Easypanel.

## Recomendacion tecnica

La forma mas simple y estable es:

- VPS con Docker y Docker Compose.
- Traefik como unico punto de entrada.
- GitHub Actions para hacer deploy por SSH al hacer push a `main`.

Esta opcion evita depender de Easypanel y mantiene el control total del stack.

## Dominios sugeridos

- `routlis.tudominio.com` para el frontend.
- `api.routlis.tudominio.com` para el backend.

Nota:

- Traefik no registra dominios en internet.
- Traefik si puede asignar automaticamente el enrutamiento interno y los certificados TLS.
- Para que eso funcione, el DNS del dominio o subdominio debe apuntar al IP del VPS.
- Si quieres menos trabajo manual, usa un wildcard DNS como `*.tudominio.com -> IP del VPS` y deja que Traefik distinga frontend y backend por `Host(...)`.
- En la practica, Traefik necesita el host final en cada router, asi que lo normal es definir `FRONTEND_HOST` y `API_HOST` en la `.env` del VPS y dejar el DNS apuntando al mismo servidor.

## Contenedores

### Traefik

- Expone `80` y `443`.
- Usa Let’s Encrypt para certificados automaticos.
- Detecta servicios por labels Docker.

### Frontend

- Expone internamente `3000`.
- Recibe `NEXT_PUBLIC_API_URL` apuntando a `https://api.routlis.tudominio.com`.

### Backend

- Expone internamente `4000`.
- Usa `DATABASE_URL` hacia `postgres`.
- Usa `FRONTEND_URL` hacia el dominio publico del frontend.
- Usa `COOKIE_SECURE=true` en produccion.

### PostgreSQL

- Persistencia en volumen.
- No se expone publicamente.

## Variables de entorno de produccion

### Backend

```env
DATABASE_URL=postgresql://routlis:********@postgres:5432/routlis?schema=public
JWT_SECRET=********
JWT_EXPIRES_IN=1d
COOKIE_NAME=routlis_token
COOKIE_SECURE=true
FRONTEND_URL=https://routlis.tudominio.com
PORT=4000
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/var/www/routlis/storage
LOCAL_AUDIO_PATH=/var/www/routlis/storage/audio-assets
PUBLIC_AUDIO_BASE_URL=https://api.routlis.tudominio.com/files/audio-assets
SEED_ADMIN_PASSWORD=********
```

### Frontend

```env
NEXT_PUBLIC_API_URL=https://api.routlis.tudominio.com
NEXT_PUBLIC_MEDIA_URL=https://api.routlis.tudominio.com
```

## Estructura de despliegue en el VPS

```txt
/opt/routlis/
  docker-compose.yml
  .env
  storage/
  app/
```

## Paso a paso de implementacion

### 1. Preparar el VPS

- Instalar Docker y Docker Compose.
- Abrir puertos 80 y 443.
- Configurar DNS de los subdominios.
- Dejar Easypanel fuera de la ruta publica de Routlis.

### 2. Crear `docker-compose.yml`

- `traefik`
- `frontend`
- `backend`
- `postgres`

### 3. Configurar labels de Traefik

- Frontend publica `routlis.tudominio.com`.
- Backend publica `api.routlis.tudominio.com`.
- Traefik enruta por host.

Si prefieres que Traefik sea quien "asigne" la exposicion web sin tocar Nginx ni Easypanel, la forma correcta es:

- crear los subdominios en tu DNS o usar un wildcard
- etiquetar los servicios Docker con `Host(...)`
- dejar que Traefik resuelva el enrutamiento y el TLS

### 4. Montar volúmenes persistentes

- `routlis_postgres_data`
- `routlis_storage`
- `routlis_traefik_letsencrypt`

### 5. Ejecutar migraciones y seed

- En cada deploy normal: `npm run prisma:migrate`
- Solo para bootstrap inicial o reseed manual: `npm run prisma:seed`

### 6. Validar funcionamiento

- `/login`
- `/board`
- `/admin/storage`
- stream de audios
- carga de imagenes

## Auto-deploy desde GitHub

### Opcion recomendada: GitHub Actions + SSH

Flujo:

1. Push a `main`.
2. GitHub Actions conecta por SSH al VPS.
3. Ejecuta:

```bash
cd /opt/routlis/app
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend npm run prisma:deploy
```

Ventajas:

- Simple.
- Controlable.
- No depende de herramientas externas.

Bootstrap manual:

- Ejecutar el mismo workflow con `workflow_dispatch`.
- Activar `run_seed=true` solo si quieres volver a cargar los datos demo del seed.
- El seed queda fuera del flujo automatico de `push` a `main`.

### Opcion alternativa: webhook propio

1. GitHub envía un webhook al VPS.
2. Un servicio liviano escucha el evento.
3. Ejecuta `git pull` y `docker compose up -d --build`.

Esta opcion es util si despues quieres cero dependencia de GitHub Actions.

## Reglas para no romper deploys

- No usar `localhost` en produccion para API o medios.
- En produccion, frontend y backend deben apuntar a dominios publicos.
- Las cookies deben ir con `secure=true`.
- Traefik debe ser el unico punto de entrada web.
- La base de datos no debe exponerse por internet.
- El seed no debe ejecutarse en cada deploy automatico.

## Criterio de exito

El deploy se considera listo cuando:

- El frontend abre desde el dominio publico.
- El login redirige a `/board`.
- Los audios reproducen.
- Las imagenes cargan.
- `/admin/storage` funciona.
- Un push a `main` actualiza automaticamente el VPS.
- El despliegue publico no depende de Easypanel.

## Siguiente paso sugerido

Implementar primero el `docker-compose.yml` de produccion con Traefik, y despues añadir el workflow de GitHub Actions para auto-deploy.
