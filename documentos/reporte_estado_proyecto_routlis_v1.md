# Reporte de estado del proyecto - Routlis 1.0 AudioBoard

Fecha de corte: 2026-06-11

## Resumen ejecutivo

Routlis V1 se encuentra en un estado funcional sólido. El backend, el frontend y el flujo principal de la botonera ya estan implementados y compilando correctamente. La interfaz de `/board` evoluciono para soportar dos modos de operacion y la experiencia general ya refleja la identidad visual del proyecto.

El despliegue de produccion ya no depende de Easypanel. Routlis quedó publicado con un Traefik propio en el VPS, redes de Swarm dedicadas y un flujo de actualizacion que parte desde `main`.

## Estado tecnico actual

### Backend

- NestJS modular operativo.
- Prisma + PostgreSQL integrados.
- Autenticacion con JWT en cookie httpOnly.
- RBAC por roles y permisos.
- `OWNER` opera como super admin global para tareas internas.
- `ADMIN`, `SUPERVISOR` y `OPERATOR` siguen limitados a su organización activa.
- Storage local protegido.
- Biblioteca de audios, categorias y botones implementadas.
- Playback events e historial implementados.
- Preferencias de botonera por usuario persistidas en base de datos.
- Favoritos por usuario persistidos en base de datos.
- Normalizacion de audio aplicada en el flujo de almacenamiento local.
- Endpoints de duplicado, reordenamiento e importacion en lote disponibles.
- Administración global de organizaciones disponible para `OWNER`.
- Despliegue en VPS verificado con login funcional, healthcheck público y Traefik propio.

### Frontend

- Next.js operativo con login, botonera y pantallas admin.
- Header y sidebar integrados con permisos.
- Modal de configuracion de cuenta disponible.
- Pantalla `/admin/organizations` disponible solo para `OWNER`.
- Botones compactos con imagen, etiqueta y popup de detalles.
- Modo simple y modo de 2 columnas en `/board`.
- Búsqueda y filtros por lado en modo dual.
- Favoritos y recientes funcionando con datos del backend.
- Selector de densidad y volumen persistente por usuario.
- Reproduccion con fade in / fade out y atajos de teclado.
- Vista rapida de historial reciente en la botonera.
- Despliegue en VPS verificado con proxy `/api`, rutas admin completas y Traefik propio.

## Estado funcional de `/board`

- El clic izquierdo en toda la tarjeta reproduce el audio.
- El clic derecho y el menu de tres puntos abren detalles.
- El popup de detalles permite ver imagen, copiar texto y descargar imagen/audio.
- El modo simple se conserva.
- El modo dual separa Lado A y Lado B con filtros independientes.
- La preferencia de vista simple/dual se guarda por usuario.
- La densidad compacta, mediana o grande se guarda por usuario.
- El volumen se guarda por usuario.
- Las listas largas usan scroll interno.
- El player inferior se mantiene fijo y no se rompe con muchas tarjetas.
- La cabecera de `/board` fue simplificada a `/Botonera` junto al selector de modo.
- El historial reciente aparece como una vista rapida dentro de la botonera.
- `Esc` detiene la reproduccion actual.

## Permisos y visibilidad

- `OPERATOR` solo ve la botonera.
- `OWNER`, `ADMIN` y `SUPERVISOR` pueden ver el panel de control segun permisos.
- `OWNER` puede ver almacenamiento en el sidebar, en el dashboard y en `/admin/storage`.
- Usuarios que no son `OWNER` no ven almacenamiento en el sidebar, en el dashboard ni en `/admin/storage`.
- `OWNER` puede cambiar la organización activa desde la pantalla de organizaciones.
- El resto de roles no puede salir del alcance de su organización.

## Verificaciones completadas

- `cd backend && npm run build`
- `cd frontend && npm run build`
- Login con cookie httpOnly verificado.
- Upload de WAV verificado.
- Importacion en lote de audios verificada a nivel de compilacion y ruta API.
- Creacion de boton verificada.
- Duplicado de boton verificado a nivel de compilacion y ruta API.
- Stream protegido de audio verificado.
- Inicio y cierre de playback event verificados.
- Consulta de historial verificada.
- Cambio de organización activa como `OWNER` verificado.
- `https://facebook-routlis-backend.273nrg.easypanel.host/health` responde `200`.
- `POST /api/auth/login` y `GET /api/auth/me` verificados en el frontend de producción.
- `https://facebook-routlis-frontend.273nrg.easypanel.host/admin/storage` responde `200`.
- Easypanel y sus stacks auxiliares fueron retirados del VPS para dejar el entorno limpio.

## Pendientes recomendados

- Seguir refinando la experiencia visual de la botonera si se agregan mas filas o categorias.
- Evaluar si hace falta drag and drop visual para reordenar botones y categorias en la interfaz.
- Evaluar si conviene agregar acciones mas visibles para importacion en lote y normalizacion avanzada en el admin.
- Mantener actualizada la guia de despliegue VPS con cualquier cambio en dominios, rutas o variables.

## Documentacion relacionada

- `README.md`
- `backend/README.md`
- `frontend/README.md`
- `documentos/plan_desarrollo_modular_routlis_v1.md`
- `documentos/despliegue_hostinger_vps_routlis_v1.md`
