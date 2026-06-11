# Routlis 1.0 AudioBoard

Aplicación modular para gestionar y reproducir audios pregrabados desde una botonera operativa.

## Release 1.0

Routlis llega a su primera version estable de producto. Esta release deja listos:

- login y autenticacion
- panel principal `/board`
- panel admin modular
- almacenamiento de audios
- despliegue estable en VPS/Easypanel

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

Entorno local instalado:

- PostgreSQL 17 portable en `pgsql-local/`.
- Datos locales en `.local-postgres/`.
- Scripts de arranque en `scripts/`.

## Arranque local

PostgreSQL portable:

```bash
./scripts/pg-local-start.sh
```

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run start:dev
```

Frontend, en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

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
http://localhost:3000
```

## Documentacion relacionada

- `backend/README.md`
- `frontend/README.md`
- `frontend/AGENTS.md`
- `documentos/plan_desarrollo_modular_routlis_v1.md`
- `documentos/reporte_estado_proyecto_routlis_v1.md`
- `documentos/despliegue_hostinger_vps_routlis_v1.md`

Detener PostgreSQL portable:

```bash
./scripts/pg-local-stop.sh
```

## Documento modular

La hoja de ruta viva esta en:

```txt
documentos/plan_desarrollo_modular_routlis_v1.md
```

El reporte de estado actual esta en:

```txt
documentos/reporte_estado_proyecto_routlis_v1.md
```

La guia de despliegue inicial esta en:

```txt
documentos/despliegue_hostinger_vps_routlis_v1.md
```
