# Routlis 1.1 AudioBoard

Aplicación modular para gestionar y reproducir audios pregrabados desde una botonera operativa.

## Release 1.1

Routlis 1.1 alinea el flujo local y el VPS para que el deploy sea reproducible, seguro y sin perdida de datos persistentes.

Esta release deja listos:

- login y autenticacion
- panel principal `/board`
- panel admin modular
- almacenamiento de audios
- despliegue estable en VPS con Docker Compose y un proxy externo
- backup, verificacion y rollback basicos en el deploy

### Cuentas de prueba

Estas cuentas quedan creadas por el seed para probar permisos:

| Email | Rol |
| --- | --- |
| `admin@routlis.local` | `OWNER` |
| `admin2@routlis.local` | `ADMIN` |
| `supervisor@routlis.local` | `SUPERVISOR` |
| `operator@routlis.local` | `OPERATOR` |

Password de seed:

```txt
Admin123*
```

En produccion, el seed queda reservado para un bootstrap manual del VPS; los `push` a `principal` actualizan codigo y migraciones, pero no vuelven a sembrar datos demo.
Los deploys normales solo reconstruyen imagenes, reinician contenedores y aplican migraciones evolutivas.
No deben usar `down -v`, ni recrear los volumenes de PostgreSQL o storage.

## Estado actual

Código base implementado:

- Backend NestJS modular.
- Prisma + PostgreSQL.
- Auth JWT con cookie httpOnly.
- RBAC por permisos.
- Storage local protegido.
- Biblioteca de audios.
- Categorías.
- Botones.
- Playback events.
- Auditoría/historial.
- Frontend Next.js con login, botonera y pantallas admin.

Estado funcional actual:

- La botonera usa tarjetas compactas con imagen y etiqueta.
- El clic izquierdo en toda la tarjeta reproduce el audio.
- El clic derecho y el menú de tres puntos abren detalles del botón.
- El popup de detalles permite ver imagen, texto y descargas.
- Los favoritos y el historial reciente ya se sirven desde backend y quedan persistidos por usuario.
- Las preferencias de vista, densidad y volumen se guardan por usuario.
- Existen filtros de recientes y favoritos.
- La pantalla `/board` tiene modo simple y modo de 2 columnas.
- En modo dual, cada lado tiene búsqueda, filtros y scroll independientes.
- Cuando hay muchas tarjetas, el contenido usa scroll interno sin mover el player.
- El encabezado de `/board` quedó simplificado y muestra solo `/Botonera` junto al selector de vista.
- La opción y la pantalla de almacenamiento en el dashboard solo se muestran a `OWNER`.
- `OWNER` funciona como super admin global y puede cambiar la organización activa desde `/admin/organizations`.
- `ADMIN`, `SUPERVISOR` y `OPERATOR` siguen limitados a su organización activa.
- Hay modal de configuración de cuenta desde el menú de usuario.
- El encabezado principal muestra la ruta activa como título.
- La pantalla de audios admite importación en lote.
- La pantalla de botones permite duplicar registros existentes.
- Las rutas sensibles siguen separadas por `organizationId` y el backend valida pertenencia antes de leer o modificar datos.

Verificado:

```bash
cd backend && npm run build
cd frontend && npm run build
```

Prueba funcional backend realizada:

- Login con cookie httpOnly.
- Upload de WAV.
- Creacion de boton.
- Stream protegido del audio.
- Inicio y cierre de playback event.
- Consulta de historial.

Prueba funcional frontend realizada:

- `/login` autentica con la cookie de sesión.
- `/board` carga la botonera y reproduce audios protegidos.
- `/board` permite alternar entre modo simple y modo 2 columnas.
- `/admin/buttons` muestra la interfaz compacta actual.
- `OWNER` ve almacenamiento en el sidebar y en `/admin`; otros roles no.

Entorno local recomendado:

- Docker Engine + Compose Plugin.
- PostgreSQL, backend y frontend en contenedores.
- Volumen persistente para la base de datos y el storage.
- El flujo principal ahora es `docker compose` en la raiz del proyecto.

## Arranque local

Levantar todo el stack:

```bash
docker compose up -d --build
```

Aplicar migraciones de Prisma:

```bash
docker compose exec backend npm run prisma:deploy
```

Si quieres cargar los datos demo del seed:

```bash
docker compose exec backend npm run prisma:seed
```

Detener el stack:

```bash
docker compose down
```

Si quieres borrar tambien los volumenes y dejar la base de datos limpia:

```bash
docker compose down -v
```

En despliegue de produccion no uses `down -v`, porque borra la base de datos y el storage persistente.

Credenciales seed:

```txt
Email: admin@routlis.local
Password: Admin123*
```

El usuario `admin@routlis.local` entra como `OWNER` global.
Desde `/admin/organizations` puede ver, crear, deshabilitar y cambiar la organización activa.

Backend:

```txt
http://localhost:4000
```

Documentacion API:

```txt
http://localhost:4000/docs
http://localhost:4000/docs-json
```

Frontend:

```txt
http://localhost:3001
```

Si levantas `frontend` con `npm run dev`, usa `http://localhost:3000`.

## Despliegue en VPS

Si vas a mover la app a un VPS con Docker Compose y un proxy externo, este es el flujo corto recomendado:

1. Copia el proyecto en `/opt/routlis/app` o clona el repositorio ahi.
2. Crea `/opt/routlis/.env` a partir de `deploy/vps.env.example` con `POSTGRES_PASSWORD`, `JWT_SECRET`, `LETSENCRYPT_EMAIL`, `FRONTEND_HOST`, `API_HOST` y `SEED_ADMIN_PASSWORD`.
3. Levanta el stack de produccion:

```bash
docker compose -f docker-compose.prod.yml -p routlis up -d --build
```

4. Aplica migraciones:

```bash
docker compose -f docker-compose.prod.yml -p routlis exec -T backend npm run prisma:deploy
```

5. Solo en el bootstrap inicial o si quieres resembrar datos demo:

```bash
docker compose -f docker-compose.prod.yml -p routlis exec -T backend npm run prisma:seed
```

6. Verifica salud y acceso publico:

```bash
curl -fsS https://api.tudominio.com/health
curl -I https://tu-dominio.com/login
```

Para un redeploy normal desde `principal`:

```bash
cd /opt/routlis/app
git pull origin principal
bash scripts/deploy-vps.sh deploy
```

Si solo quieres sembrar datos demo en el bootstrap inicial:

```bash
bash scripts/deploy-vps.sh seed
```

El seed no debe ejecutarse en cada despliegue automatico.

### VPS con proxy externo

El VPS actual usa un proxy externo fuera del compose de la app. La aplicación solo necesita levantar `postgres`, `backend` y `frontend`, y el proxy externo apunta a los puertos internos de esos contenedores.

### Estado estable del login

La pantalla de login consulta estadísticas públicas como ayuda visual. Si ese endpoint falla temporalmente, el acceso no debe bloquearse: el formulario de autenticación sigue siendo la fuente real de entrada al panel.

## Checklist estable

La guia operativa actualizada para la version v1.1 esta en:

- [`documentos/activos/checklist_estado_estable_v1_1.md`](/home/leonardo/Documentos/Proyectos/ROUTLIS/documentos/activos/checklist_estado_estable_v1_1.md)

Ultima prueba de despliegue automatizado: commit de validacion en `principal`.

## Persistencia que no debe perderse en deploys

Estos datos deben sobrevivir a commits, pulls, builds y redeploys normales:

- usuarios y roles
- organizaciones y membresias
- preferencias del usuario
- categorias
- audios subidos
- botones creados por usuarios
- imagenes asociadas a botones
- favoritos
- historial de reproduccion
- configuraciones operativas del panel

Lo unico que debe cambiar en un deploy normal es el codigo. Si una tarea requiere borrar datos, debe hacerse de forma manual y deliberada, nunca por el flujo de despliegue.

Arranque de produccion:

```bash
docker compose -f docker-compose.prod.yml -p routlis up -d --build
```

Bootstrap del seed:

```bash
docker compose -f docker-compose.prod.yml -p routlis exec -T backend npm run prisma:seed
```

Si rearmas el VPS desde cero, crea `/opt/routlis/.env` con los valores de produccion y luego levanta el stack.

Antes de desplegar, valida que existan los volumenes persistentes:

```bash
bash scripts/deploy-vps.sh preflight
```

Flujo seguro recomendado:

```bash
bash scripts/deploy-vps.sh backup
bash scripts/deploy-vps.sh deploy
bash scripts/deploy-vps.sh verify
```

Si algo falla despues del despliegue, puedes volver al ultimo backup disponible:

```bash
bash scripts/deploy-vps.sh rollback
```

## Documentacion relacionada

- `backend/README.md`
- `frontend/README.md`
- `frontend/AGENTS.md`
- `documentos/historicos/plan_desarrollo_modular_routlis_v1.md`
- `documentos/historicos/reporte_estado_proyecto_routlis_v1.md`
- `documentos/historicos/plan_deploy_vps_traefik_autodeploy_routlis_v1.md`
- `documentos/historicos/despliegue_hostinger_vps_routlis_v1.md`
- `documentos/historicos/checklist_persistencia_deploy_routlis.md`
- `documentos/historicos/variables_github_easypanel_routlis_v1.md`
- `documentos/historicos/checklist_despliegue_10_min_routlis_v1.md`

## Documento modular

La hoja de ruta viva esta en:

```txt
documentos/historicos/plan_desarrollo_modular_routlis_v1.md
```

El reporte de estado actual esta en:

```txt
documentos/historicos/reporte_estado_proyecto_routlis_v1.md
```

La guia de despliegue inicial esta en:

```txt
documentos/historicos/despliegue_hostinger_vps_routlis_v1.md
```
