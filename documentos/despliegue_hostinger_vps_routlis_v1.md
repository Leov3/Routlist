# Despliegue Hostinger VPS - Routlis V1 AudioBoard

## Estado previo

El proyecto ya cuenta con:

- Backend NestJS compilable.
- Frontend Next.js compilable.
- PostgreSQL probado localmente.
- Migracion Prisma inicial.
- Seed inicial.
- Storage local para audios.
- Healthcheck en `GET /health`.
- Configuracion PM2 en `ecosystem.config.js`.

## Requisitos del VPS

Sistema recomendado:

```txt
Ubuntu 22.04/24.04 o Debian 12/13
```

Paquetes necesarios:

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql postgresql-contrib
```

Node.js recomendado:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm alias default 'lts/*'
node --version
npm --version
```

PM2:

```bash
npm install -g pm2
```

## Crear base de datos

Entrar a PostgreSQL:

```bash
sudo -u postgres psql
```

Crear usuario y base:

```sql
CREATE USER routlis WITH PASSWORD 'CAMBIAR_PASSWORD_SEGURO';
CREATE DATABASE routlis OWNER routlis;
GRANT ALL PRIVILEGES ON DATABASE routlis TO routlis;
\q
```

## Estructura sugerida en VPS

```txt
/var/www/routlis/app
/var/www/routlis/storage/audio-assets
```

Crear carpetas:

```bash
sudo mkdir -p /var/www/routlis/app
sudo mkdir -p /var/www/routlis/storage/audio-assets
sudo chown -R $USER:$USER /var/www/routlis
```

## Subir o clonar proyecto

Desde el VPS:

```bash
cd /var/www/routlis
git clone TU_REPOSITORIO app
cd app
```

Si se sube por SFTP/rsync, copiar el contenido del proyecto dentro de:

```txt
/var/www/routlis/app
```

## Variables de entorno backend

Crear `backend/.env`:

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
```

Valores clave:

```env
DATABASE_URL="postgresql://routlis:CAMBIAR_PASSWORD_SEGURO@127.0.0.1:5432/routlis?schema=public"
JWT_SECRET="GENERAR_UN_SECRETO_LARGO_Y_UNICO"
COOKIE_SECURE="true"
FRONTEND_URL="https://tu-dominio.com"
LOCAL_STORAGE_PATH="/var/www/routlis/storage"
LOCAL_AUDIO_PATH="/var/www/routlis/storage/audio-assets"
PORT="4000"
```

Generar `JWT_SECRET`:

```bash
openssl rand -base64 48
```

## Variables de entorno frontend

Crear `frontend/.env.production`:

```bash
cp frontend/.env.production.example frontend/.env.production
nano frontend/.env.production
```

Ejemplo:

```env
NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
```

Si frontend y backend usan el mismo dominio con proxy por ruta, se puede usar:

```env
NEXT_PUBLIC_API_URL=https://tu-dominio.com/api
```

En ese caso se debe ajustar Nginx para enrutar `/api` al backend.

## Instalar dependencias y compilar

Backend:

```bash
cd /var/www/routlis/app/backend
npm ci
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run build
```

Frontend:

```bash
cd /var/www/routlis/app/frontend
npm ci
npm run build
```

## Ejecutar con PM2

Desde la raiz del proyecto:

```bash
cd /var/www/routlis/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Ver estado:

```bash
pm2 status
pm2 logs routlis-backend
pm2 logs routlis-frontend
```

## Nginx con subdominios separados

Ejemplo:

```txt
tu-dominio.com -> frontend Next.js en puerto 3000
api.tu-dominio.com -> backend NestJS en puerto 4000
```

Crear archivo:

```bash
sudo nano /etc/nginx/sites-available/routlis
```

Contenido:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.tu-dominio.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/routlis /etc/nginx/sites-enabled/routlis
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

Instalar Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Emitir certificados:

```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com -d api.tu-dominio.com
```

Despues de HTTPS confirmar:

```env
COOKIE_SECURE="true"
FRONTEND_URL="https://tu-dominio.com"
NEXT_PUBLIC_API_URL="https://api.tu-dominio.com"
```

Rebuild/restart si cambian variables frontend:

```bash
cd /var/www/routlis/app/frontend
npm run build
pm2 restart routlis-frontend
pm2 restart routlis-backend
```

## Verificacion post despliegue

Backend:

```bash
curl https://api.tu-dominio.com/health
```

Debe responder:

```json
{"status":"ok","database":"ok"}
```

Frontend:

```txt
https://tu-dominio.com/login
```

Credenciales iniciales:

```txt
Email: admin@routlis.local
Password: valor de SEED_ADMIN_PASSWORD usado en el seed
```

## Checklist V1

- `pm2 status` muestra backend y frontend online.
- `GET /health` responde `ok`.
- Login funciona.
- Se puede subir WAV/MP3.
- Se puede crear boton asociado al audio.
- La botonera muestra el boton.
- El audio reproduce desde el navegador.
- El historial registra inicio/detencion.
- `client_max_body_size` en Nginx permite al menos 25M.
- La carpeta `/var/www/routlis/storage/audio-assets` pertenece al usuario que ejecuta PM2.

## Comandos utiles

Reiniciar app:

```bash
pm2 restart routlis-backend
pm2 restart routlis-frontend
```

Ver logs:

```bash
pm2 logs
```

Backup base de datos:

```bash
pg_dump -U routlis -h 127.0.0.1 routlis > routlis_backup.sql
```

Restaurar backup:

```bash
psql -U routlis -h 127.0.0.1 routlis < routlis_backup.sql
```

## Despliegue real en Easypanel / VPS

Este proyecto ya fue probado en un VPS con Easypanel y Traefik. Estas son las reglas que evitaron los errores que aparecieron durante el despliegue:

- El backend debe desplegarse como servicio Docker separado del frontend.
- El frontend también debe desplegarse como servicio independiente.
- El dominio público del frontend debe ser el punto de entrada del navegador.
- El backend debe quedar expuesto por su propio dominio de Traefik.
- No conviene depender de cookies cruzadas entre dominios distintos si se puede evitar.

### Lo que funcionó mejor

- Usar `frontend` como origen principal del navegador.
- Hacer que el frontend llame al backend por proxy interno con `/api`.
- Mantener el backend con JWT en cookie `HttpOnly`.
- Configurar `SameSite=None` en producción cuando el login cruza dominios.
- Usar `Secure=true` en HTTPS real.
- Normalizar `FRONTEND_URL` sin slash final.

### Ruta y nombres que se verificaron

- Backend público: `https://facebook-routlis-backend.273nrg.easypanel.host`
- Frontend público: `https://facebook-routlis-frontend.273nrg.easypanel.host`
- Proxy frontend: `/api/*` -> backend público

### Variables que terminaron siendo importantes

Backend:

```env
DATABASE_URL=postgres://...
JWT_SECRET=...
FRONTEND_URL=https://facebook-routlis-frontend.273nrg.easypanel.host
PORT=4000
NODE_ENV=production
```

Frontend:

```env
BACKEND_URL=https://facebook-routlis-backend.273nrg.easypanel.host
PORT=3000
NODE_ENV=production
```

### Ajustes de código que se tuvieron que hacer

- `backend/src/modules/auth/auth.controller.ts`
  - cookies de login y cambio de organización con `SameSite=None`
- `backend/src/config/configuration.ts`
  - `FRONTEND_URL` sin slash final
- `frontend/src/lib/api.ts`
  - uso de `"/api"` como base URL
- `frontend/next.config.ts`
  - rewrite de `/api/:path*` hacia el backend
- `frontend/Dockerfile`
  - build arg `BACKEND_URL`

### Errores que aparecieron y cómo se resolvieron

- `login` se quedaba en “validando”:
  - se corrigió la sesión cross-site y luego se evitó el cruce de dominio con el proxy `/api`
- `404` en `/admin/storage`:
  - la copia de Easypanel no tenía esa ruta en el árbol del frontend
  - se agregó el archivo y se reconstruyó la imagen
- el backend y el frontend estaban vivos pero no coordinados:
  - se verificó con `curl` que el backend respondía `200`
  - se verificó que `POST /api/auth/login` y `GET /api/auth/me` funcionaran

### Comandos útiles para futuros despliegues

```bash
docker service update --force facebook_routlis_backend
docker service update --force facebook_routlis_frontend
docker service ps facebook_routlis_backend
docker service ps facebook_routlis_frontend
curl -k https://facebook-routlis-backend.273nrg.easypanel.host/health
curl -k -I https://facebook-routlis-frontend.273nrg.easypanel.host/admin/storage
```

### Verificaciones mínimas antes de dar por bueno un deploy

1. `GET /health` en backend responde `200`.
2. `POST /api/auth/login` responde `200` desde el frontend.
3. `GET /api/auth/me` responde `200` con la cookie de sesión.
4. `/admin/storage` responde `200`.
5. El panel entra sin quedarse bloqueado en “validando acceso”.
