# Plan de desarrollo modular - Routlis V1 AudioBoard

> Documento historico de planificacion. La ruta activa actual de Routlis v1.1 queda documentada en el README y en `documentos/activos/checklist_estado_estable_v1_1.md`.

## Resumen

Routlis V1 se desarrollara en **13 modulos principales**, numerados del 0 al 12.

Estado actual:

- **Modulos totales:** 13
- **Modulos con codigo base implementado:** 11
- **Modulos validados localmente con base de datos:** 12
- **Modulos parcialmente implementados:** 0
- **Modulos pendientes sin codigo:** 0

Nota: se instalo PostgreSQL 17 portable para desarrollo local, se aplico la migracion inicial, se ejecuto seed y se valido el flujo backend con audio de prueba: upload, creacion de boton, stream, playback event e historial.

Actualizacion de permisos/UI:

- La navegacion principal usa sidebar izquierdo.
- La navegacion se filtra segun rol y permisos del usuario autenticado.
- `OPERATOR` solo ve la botonera.
- `OWNER` actua como super admin global y puede administrar organizaciones.
- `ADMIN`, `SUPERVISOR` y `OPERATOR` siguen limitados a su organizacion activa.
- `OWNER`, `ADMIN` y `SUPERVISOR` pueden ver el panel de control segun sus permisos.
- Las rutas administrativas bloquean acceso manual si falta el permiso requerido.
- `ADMIN` no puede crear usuarios `OWNER`; solo `SUPERVISOR` y `OPERATOR`.
- `OWNER` no se asigna manualmente como rol operativo; se reserva para el super admin global existente.
- La botonera de escritorio usa tarjetas compactas con imagen y etiqueta.
- El clic izquierdo en toda la tarjeta reproduce el audio.
- El clic derecho y el menu de tres puntos abren el popup de detalles del boton.
- El popup permite ver imagen, copiar texto y descargar imagen/audio.
- Existen filtros de recientes y favoritos en la botonera.
- La pantalla `/board` soporta modo simple y modo de 2 columnas.
- En modo dual, cada lado tiene filtros y busqueda independientes.
- Las listas largas usan scroll interno para no afectar el player inferior.
- La cabecera de `/board` muestra solo `/Botonera` junto al selector de vista.
- La opcion y la pantalla de almacenamiento solo se muestran a usuarios `OWNER`.
- Existe una pantalla global de organizaciones en `/admin/organizations` para `OWNER`.
- `OWNER` puede cambiar la organizacion activa desde la interfaz.
- El encabezado principal muestra la ruta activa como titulo.

---

## Modulo 0 - Base backend, Prisma, Auth y RBAC

**Estado:** validado localmente.

**Objetivo:** crear el cimiento tecnico del backend.

**Incluye:**

- Proyecto NestJS.
- Configuracion por variables de entorno.
- Prisma ORM.
- Schema inicial multiempresa.
- Seed inicial.
- JWT en cookie httpOnly.
- Login, logout y usuario autenticado.
- Guards de autenticacion y permisos.
- Decoradores `@CurrentUser()` y `@Permissions()`.
- Roles y permisos iniciales.
- Endpoints base de usuarios, organizacion y RBAC.

**Archivos principales:**

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/modules/auth`
- `backend/src/modules/users`
- `backend/src/modules/rbac`
- `backend/src/modules/organizations`

**Criterios de terminado:**

- `npm run build` pasa.
- `npm run prisma:generate` pasa.
- Migracion inicial aplicada en PostgreSQL.
- Seed ejecutado correctamente.
- Login funciona con `admin@routlis.local`.

**Pendiente tecnico:**

- Instalar o habilitar PostgreSQL/Docker para probar migracion y seed.

---

## Modulo 1 - Entorno local y base de datos

**Estado:** validado localmente con PostgreSQL portable.

**Objetivo:** dejar el entorno de desarrollo funcionando de punta a punta.

**Incluye:**

- PostgreSQL local o via Docker.
- Migracion Prisma inicial.
- Seed inicial.
- Verificacion manual de endpoints base.
- Documentacion de comandos reales.

**Criterios de terminado:**

- PostgreSQL corre localmente.
- `npm run prisma:migrate -- --name init` funciona.
- `npm run prisma:seed` funciona.
- Backend arranca en `http://localhost:4000`.
- `POST /auth/login` devuelve cookie de sesion.
- `GET /auth/me` funciona autenticado.

---

## Modulo 2 - Storage local protegido

**Estado:** codigo base listo.

**Objetivo:** preparar la capa de almacenamiento de audios sin acoplarla al filesystem.

**Incluye:**

- `StorageModule`.
- Interfaz de storage.
- Implementacion `LocalStorageService`.
- Validacion de MIME type.
- Limite inicial de 20 MB.
- Rutas de almacenamiento por organizacion.
- Preparacion para migrar en futuro a S3/R2.

**Criterios de terminado:**

- El backend puede guardar archivos en disco local.
- El storage genera `storageKey`.
- El storage no expone archivos publicamente sin control.
- Tests o verificacion manual de guardado y eliminacion logica.

---

## Modulo 3 - Biblioteca de audios

**Estado:** codigo base listo.

**Objetivo:** permitir que administradores suban y administren audios.

**Incluye:**

- `AudioLibraryModule`.
- Upload MP3/WAV.
- Metadata en PostgreSQL.
- Listar audios por organizacion.
- Editar metadata.
- Activar/desactivar audio.
- Borrado logico.
- Endpoint protegido para servir audio.

**Endpoints previstos:**

- `GET /audio-assets`
- `POST /audio-assets`
- `GET /audio-assets/:id`
- `PATCH /audio-assets/:id`
- `DELETE /audio-assets/:id`
- `GET /audio-assets/:id/stream`

**Criterios de terminado:**

- `ADMIN` y `OWNER` pueden subir audios.
- `OPERATOR` no puede crear/editar/eliminar audios.
- Se rechazan formatos no permitidos.
- Todas las consultas filtran por `organizationId`.

---

## Modulo 4 - Categorias de audio

**Estado:** codigo base listo.

**Objetivo:** administrar agrupaciones visuales y operativas de la botonera.

**Incluye:**

- `CategoriesModule`.
- Crear categoria.
- Editar nombre, descripcion y orden.
- Activar/desactivar categoria.
- Listar categorias activas.

**Endpoints previstos:**

- `GET /audio-categories`
- `POST /audio-categories`
- `PATCH /audio-categories/:id`
- `DELETE /audio-categories/:id`

**Criterios de terminado:**

- `ADMIN` y `OWNER` gestionan categorias.
- `SUPERVISOR` y `OPERATOR` solo leen.
- Ordenamiento estable por `sortOrder`.
- Separacion por organizacion.

---

## Modulo 5 - Botones de audio

**Estado:** codigo base listo.

**Objetivo:** crear botones visibles que conectan categorias con audios.

**Incluye:**

- `AudioButtonsModule`.
- Crear boton asociado a un audio.
- Asociar boton a categoria.
- Label, descripcion, color, shortcut y orden.
- Activar/desactivar boton.
- Endpoint especial para botonera agrupada.

**Endpoints previstos:**

- `GET /audio-buttons`
- `POST /audio-buttons`
- `GET /audio-buttons/board`
- `PATCH /audio-buttons/:id`
- `DELETE /audio-buttons/:id`

**Criterios de terminado:**

- La botonera devuelve solo categorias y botones activos.
- Los botones incluyen URL/endpoint reproducible protegido.
- No se pueden asociar audios o categorias de otra organizacion.

---

## Modulo 6 - Playback events

**Estado:** codigo base listo.

**Objetivo:** registrar inicio, detencion y finalizacion de reproducciones.

**Incluye:**

- `PlaybackModule`.
- Evento de inicio.
- Evento de parada/finalizacion.
- Modo inicial `LOCAL_BROWSER`.
- Preparacion para estrategias futuras.

**Endpoints previstos:**

- `POST /playback-events/start`
- `PATCH /playback-events/:id/stop`

**Criterios de terminado:**

- Cada reproduccion crea un evento.
- Al detener/finalizar se actualiza `stoppedAt`.
- Se registra `durationPlayedSeconds`.
- Un usuario solo puede cerrar eventos de su organizacion.

---

## Modulo 7 - Auditoria e historial

**Estado:** codigo base listo.

**Objetivo:** consultar historial operativo de reproducciones.

**Incluye:**

- `AuditModule`.
- Listado de eventos.
- Filtros por usuario, audio, categoria y fecha.
- Paginacion basica.

**Endpoint previsto:**

- `GET /audit/playback-events`

**Criterios de terminado:**

- `OWNER`, `ADMIN` y `SUPERVISOR` pueden consultar historial.
- `OPERATOR` no puede ver historial administrativo.
- Los filtros funcionan por organizacion.

---

## Modulo 8 - Frontend base, layout y cliente API

**Estado:** codigo base listo.

**Objetivo:** crear la aplicacion Next.js y la base visual/tecnica.

**Incluye:**

- Proyecto Next.js con TypeScript.
- Tailwind CSS.
- App Router.
- Cliente API con cookies.
- Layout principal.
- Componentes UI base.
- Manejo de sesion.
- Rutas protegidas.

**Criterios de terminado:**

- Frontend arranca en `http://localhost:3000`.
- Puede consultar el backend.
- Existe layout para `/board` y `/admin`.
- Redirecciona a `/login` si no hay sesion.

---

## Modulo 9 - Login frontend y sesion

**Estado:** codigo base listo.

**Objetivo:** implementar la experiencia de autenticacion.

**Incluye:**

- Pantalla `/login`.
- Formulario email/password.
- Manejo de errores.
- Persistencia por cookie httpOnly.
- `GET /auth/me`.
- Logout.
- Redireccion segun rol.

**Criterios de terminado:**

- Login con admin seed funciona.
- Credenciales invalidas muestran error.
- Logout limpia sesion.
- Usuarios no autenticados no entran a `/board` ni `/admin`.

---

## Modulo 10 - Botonera operativa frontend

**Estado:** codigo base listo.

**Objetivo:** crear la pantalla principal del operador.

**Incluye:**

- Ruta `/board`.
- Componentes `AudioBoard`, `CategorySection`, `AudioButton`, `AudioPlayerBar`, `AudioSearch`.
- Hook `useAudioPlayback`.
- Busqueda de botones.
- Reproduccion local.
- Pausar, reanudar y detener.
- Evitar reproduccion simultanea.
- Registro de playback start/stop.

**Criterios de terminado:**

- El operador ve categorias y botones activos.
- Solo un audio suena a la vez.
- El boton activo se resalta.
- Al terminar naturalmente se registra cierre del evento.
- Funciona en escritorio y movil.

---

## Modulo 11 - Administracion frontend

**Estado:** codigo base listo.

**Objetivo:** construir las pantallas administrativas de V1.

**Incluye:**

- `/admin/audios`
- `/admin/categories`
- `/admin/buttons`
- `/admin/users`
- Formularios de creacion/edicion.
- Activar/desactivar registros.
- Upload de audios.
- Asignacion de roles.

**Criterios de terminado:**

- `ADMIN` y `OWNER` gestionan audios, categorias, botones y usuarios.
- `SUPERVISOR` no puede modificar.
- `OPERATOR` no accede al admin.
- La UI refleja errores de permisos y validacion.

---

## Modulo 12 - Historial frontend, QA y preparacion VPS

**Estado:** validado para despliegue inicial.

**Objetivo:** cerrar la V1 funcional y dejarla lista para despliegue inicial.

**Incluye:**

- Pantalla `/admin/history`.
- Filtros de historial.
- Pruebas manuales de roles.
- Ajustes responsive.
- Variables de entorno finales.
- Documentacion de despliegue en VPS Hostinger.
- Recomendaciones Nginx/storage.

**Criterios de terminado:**

- Flujo completo V1 funciona:
  1. Login.
  2. Crear categorias.
  3. Subir audios.
  4. Crear botones.
  5. Operador reproduce audios.
  6. Historial registra reproducciones.
- Build de backend pasa.
- Build de frontend pasa.
- Guia de despliegue inicial documentada.

---

## Dependencias entre modulos

```txt
Modulo 0 -> Modulo 1
Modulo 1 -> Modulo 2
Modulo 2 -> Modulo 3
Modulo 3 -> Modulo 4
Modulo 4 -> Modulo 5
Modulo 5 -> Modulo 6
Modulo 6 -> Modulo 7
Modulo 0 + Modulo 1 -> Modulo 8
Modulo 8 -> Modulo 9
Modulo 5 + Modulo 6 + Modulo 9 -> Modulo 10
Modulo 3 + Modulo 4 + Modulo 5 + Modulo 9 -> Modulo 11
Modulo 7 + Modulo 11 -> Modulo 12
```

---

## Orden recomendado de ejecucion

1. Terminar validacion del Modulo 0 con PostgreSQL real.
2. Modulo 1 - entorno local y base de datos.
3. Modulo 2 - storage local protegido.
4. Modulo 3 - biblioteca de audios.
5. Modulo 4 - categorias.
6. Modulo 5 - botones.
7. Modulo 6 - playback events.
8. Modulo 7 - auditoria.
9. Modulo 8 - frontend base.
10. Modulo 9 - login frontend.
11. Modulo 10 - botonera operativa.
12. Modulo 11 - administracion frontend.
13. Modulo 12 - historial, QA y VPS.

---

## Regla de avance

Cada modulo debe cerrarse con:

- Codigo implementado.
- Build o verificacion tecnica.
- Endpoints o pantallas probadas manualmente.
- Permisos RBAC revisados.
- Separacion por `organizationId` verificada cuando aplique.
- README o documento actualizado si cambia el flujo de arranque.

---

## Siguiente paso critico

El siguiente paso recomendado es ejecutar la instalacion en el VPS:

```txt
Despliegue Hostinger VPS
```

Documento:

```txt
documentos/historicos/despliegue_hostinger_vps_routlis_v1.md
```

Razon: la V1 ya tiene codigo base, build, base de datos local y prueba operativa backend. Falta ejecutar los pasos en el VPS real con dominio, HTTPS y variables de produccion.
