# Routlis V1 Proyecto (Botonera Modular de Audios)

## 1. Nombre del proyecto

**Routlis V1 Proyecto (Botonera Modular de Audios)**

Nombre técnico sugerido del repositorio:

```txt
routlis-v1-audio-board
```

Nombre visual sugerido en la interfaz:

```txt
Routlis AudioBoard
```

---

## 2. Objetivo general

Desarrollar una aplicación web modular para gestionar y reproducir audios pregrabados mediante una botonera operativa.

La V1 debe permitir que un administrador cargue audios, los organice en categorías y los convierta en botones visibles para operadores. Los operadores podrán reproducir los audios localmente desde el navegador durante una atención telefónica, por WhatsApp Web, softphone, videollamada u otro canal externo.

La aplicación debe estar construida con arquitectura modular para que en versiones futuras pueda integrarse con WhatsApp, Chatwoot, llamadas, campañas, CRM, analítica y facturación sin rehacer la base del sistema.

---

## 3. Descripción oficial del producto

**Routlis V1 Proyecto** es una aplicación web modular para gestionar y reproducir audios pregrabados mediante una botonera operativa.

La V1 permitirá que administradores carguen audios, los organicen en categorías y los conviertan en botones disponibles para operadores. Los operadores podrán reproducir audios localmente desde el navegador, mientras el sistema registra el historial de uso y aplica control de acceso por roles y permisos.

La arquitectura estará preparada para futuras integraciones con WhatsApp, Chatwoot, llamadas, campañas, CRM, analítica y facturación.

---

## 4. Stack tecnológico requerido

### Frontend

- Next.js.
- TypeScript.
- Tailwind CSS.
- App Router.
- Componentes reutilizables.
- Diseño responsive.

### Backend

- NestJS.
- TypeScript.
- Arquitectura modular.
- API REST.
- Validaciones con DTOs.
- Guards para autenticación y autorización.

### Base de datos

- PostgreSQL.
- Prisma ORM.
- Migraciones con Prisma.

### Storage de audios

- Almacenamiento local en VPS Hostinger para las primeras versiones.
- Guardar archivos reales en una carpeta protegida del servidor.
- Guardar metadata en PostgreSQL.
- Dejar preparada una abstracción de storage para migrar en el futuro a S3/R2 si el proyecto crece.

### Autenticación

- JWT.
- Cookies httpOnly recomendadas.
- Password hashing con bcrypt o argon2.
- Refresh token opcional para V1.

### RBAC

- Roles y permisos propios en base de datos.
- Validación de permisos desde NestJS Guards.
- Separación por organización.

---

## 5. Alcance funcional de la V1

### Incluye

- Login de usuarios.
- Gestión de organizaciones.
- Gestión de usuarios.
- Gestión básica de roles.
- Gestión de permisos RBAC.
- Biblioteca de audios.
- Carga de archivos MP3/WAV.
- Gestión de categorías.
- Creación de botones de audio.
- Botonera operativa para operadores.
- Reproducción local en navegador.
- Pausar/detener audio.
- Evitar reproducción simultánea.
- Buscador de audios.
- Historial de reproducciones.
- Separación de datos por organización.
- Backend modular preparado para futuras integraciones.

### No incluye en V1

- Integración con WhatsApp API.
- Integración con WhatsApp Web.
- Integración con Chatwoot.
- Llamadas integradas.
- Inyección de audio en llamadas.
- Campañas masivas.
- CRM completo.
- Facturación.
- IA.
- WebSockets.
- Redis.
- BullMQ.

Sin embargo, la arquitectura debe quedar preparada para agregar esos módulos después.

---

## 6. Roles iniciales

Crear los siguientes roles:

```txt
OWNER
ADMIN
SUPERVISOR
OPERATOR
```

---

## 7. Permisos sugeridos

```txt
organization:read
organization:update

user:create
user:read
user:update
user:disable

role:read
permission:read

audio:create
audio:read
audio:update
audio:delete

category:create
category:read
category:update
category:delete

button:create
button:read
button:update
button:delete

board:use

history:read
```

---

## 8. Matriz de permisos inicial

| Permiso | OWNER | ADMIN | SUPERVISOR | OPERATOR |
|---|---:|---:|---:|---:|
| organization:read | Sí | Sí | Sí | No |
| organization:update | Sí | No | No | No |
| user:create | Sí | Sí | No | No |
| user:read | Sí | Sí | Sí | No |
| user:update | Sí | Sí | No | No |
| user:disable | Sí | Sí | No | No |
| role:read | Sí | Sí | Sí | No |
| permission:read | Sí | Sí | Sí | No |
| audio:create | Sí | Sí | No | No |
| audio:read | Sí | Sí | Sí | Sí |
| audio:update | Sí | Sí | No | No |
| audio:delete | Sí | Sí | No | No |
| category:create | Sí | Sí | No | No |
| category:read | Sí | Sí | Sí | Sí |
| category:update | Sí | Sí | No | No |
| category:delete | Sí | Sí | No | No |
| button:create | Sí | Sí | No | No |
| button:read | Sí | Sí | Sí | Sí |
| button:update | Sí | Sí | No | No |
| button:delete | Sí | Sí | No | No |
| board:use | Sí | Sí | Sí | Sí |
| history:read | Sí | Sí | Sí | No |

---

## 9. Arquitectura general

Separar frontend y backend en dos aplicaciones.

```txt
/routlis-v1-audio-board
├── frontend/
│   └── Next.js + Tailwind CSS
│
└── backend/
    └── NestJS + Prisma + PostgreSQL
```

---

## 9.1. Decisión de almacenamiento para primeras versiones

Para las primeras versiones de Routlis V1 Proyecto no se usará Amazon S3 ni Cloudflare R2.

La aplicación será desplegada en un VPS de Hostinger y los audios se almacenarán localmente en el servidor.

Ruta sugerida de almacenamiento:

```txt
/var/www/routlis/storage/audio-assets/{organizationId}/{audioAssetId}.mp3
```

La base de datos PostgreSQL no debe guardar el archivo binario. Solo debe guardar metadata como:

```txt
storageDriver = local
storageKey
fileName
originalName
mimeType
sizeBytes
durationSeconds
```

El backend debe exponer los audios de forma controlada, idealmente con un endpoint protegido que valide sesión, organización y permisos antes de entregar el archivo.

También se debe mantener una interfaz de storage para migrar en el futuro a S3/R2 sin rehacer el módulo de audios.

---

## 10. Backend — estructura modular NestJS

```txt
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/
│   │   ├── env.validation.ts
│   │   └── configuration.ts
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── permissions.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── permissions.guard.ts
│   │   ├── interceptors/
│   │   ├── filters/
│   │   └── utils/
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── users/
│   │   ├── rbac/
│   │   ├── audio-library/
│   │   ├── categories/
│   │   ├── audio-buttons/
│   │   ├── playback/
│   │   ├── audit/
│   │   └── storage/
│   │
│   └── shared/
│       ├── types/
│       └── constants/
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
└── package.json
```

---

## 11. Frontend — estructura Next.js

```txt
frontend/
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── board/
│   │   │   └── page.tsx
│   │   ├── admin/
│   │   │   ├── audios/
│   │   │   │   └── page.tsx
│   │   │   ├── categories/
│   │   │   │   └── page.tsx
│   │   │   ├── buttons/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   └── history/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── audio-board/
│   │       ├── AudioBoard.tsx
│   │       ├── AudioButton.tsx
│   │       ├── CategorySection.tsx
│   │       ├── AudioPlayerBar.tsx
│   │       └── AudioSearch.tsx
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── audio-board/
│   │   ├── audio-library/
│   │   ├── categories/
│   │   ├── users/
│   │   └── audit/
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   │
│   └── types/
│
└── package.json
```

---

## 12. Modelo de base de datos Prisma

Crear un esquema inicial similar al siguiente:

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members         OrganizationMember[]
  audioAssets     AudioAsset[]
  audioCategories AudioCategory[]
  audioButtons    AudioButton[]
  playbackEvents  PlaybackEvent[]
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  fullName     String
  status       String   @default("ACTIVE")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships    OrganizationMember[]
  createdAudios  AudioAsset[]
  playbackEvents PlaybackEvent[]
}

model OrganizationMember {
  id             String   @id @default(uuid())
  organizationId String
  userId         String
  roleId         String
  status         String   @default("ACTIVE")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
  role         Role         @relation(fields: [roleId], references: [id])

  @@unique([organizationId, userId])
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     OrganizationMember[]
  permissions RolePermission[]
}

model Permission {
  id          String   @id @default(uuid())
  key         String   @unique
  description String?
  createdAt   DateTime @default(now())

  roles RolePermission[]
}

model RolePermission {
  id           String @id @default(uuid())
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionId], references: [id])

  @@unique([roleId, permissionId])
}

model AudioCategory {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  description    String?
  sortOrder      Int      @default(0)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization  @relation(fields: [organizationId], references: [id])
  buttons      AudioButton[]
}

model AudioAsset {
  id              String   @id @default(uuid())
  organizationId  String
  fileName        String
  originalName    String
  mimeType        String
  sizeBytes       Int
  durationSeconds Int?
  storageKey      String
  publicUrl       String?
  transcript      String?
  createdById     String
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization Organization    @relation(fields: [organizationId], references: [id])
  createdBy    User            @relation(fields: [createdById], references: [id])
  buttons      AudioButton[]
  events       PlaybackEvent[]
}

model AudioButton {
  id             String   @id @default(uuid())
  organizationId String
  categoryId     String
  audioAssetId   String
  label          String
  description    String?
  color          String?
  shortcutKey    String?
  sortOrder      Int      @default(0)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization   @relation(fields: [organizationId], references: [id])
  category     AudioCategory  @relation(fields: [categoryId], references: [id])
  audioAsset   AudioAsset     @relation(fields: [audioAssetId], references: [id])
  events       PlaybackEvent[]
}

model PlaybackEvent {
  id                    String    @id @default(uuid())
  organizationId         String
  userId                 String
  audioButtonId          String
  audioAssetId           String
  playbackMode           String    @default("LOCAL_BROWSER")
  startedAt              DateTime  @default(now())
  stoppedAt              DateTime?
  durationPlayedSeconds  Int?
  contextType            String    @default("NONE")
  contextId              String?

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
  audioButton  AudioButton  @relation(fields: [audioButtonId], references: [id])
  audioAsset   AudioAsset   @relation(fields: [audioAssetId], references: [id])
}
```

---

## 13. Módulos backend requeridos

### Auth Module

Responsabilidades:

- Login.
- Validación de credenciales.
- Generación de JWT.
- Logout.
- Obtener usuario autenticado.
- Protección de endpoints.

Endpoints sugeridos:

```txt
POST /auth/login
POST /auth/logout
GET /auth/me
```

### Organizations Module

Responsabilidades:

- Crear organización inicial.
- Consultar organización.
- Actualizar datos básicos.
- Validar organización activa.

Endpoints sugeridos:

```txt
GET /organizations/current
PATCH /organizations/current
```

### Users Module

Responsabilidades:

- Crear usuarios.
- Listar usuarios de la organización.
- Cambiar estado de usuario.
- Asignar rol.

Endpoints sugeridos:

```txt
GET /users
POST /users
GET /users/:id
PATCH /users/:id
PATCH /users/:id/disable
```

### RBAC Module

Responsabilidades:

- Definir roles.
- Definir permisos.
- Consultar permisos del usuario.
- Guard para validar permisos.
- Decorador `@Permissions()`.

Ejemplo esperado:

```ts
@Permissions('audio:create')
@Post()
createAudio() {}
```

### Storage Module

Responsabilidades:

- Subir archivo al almacenamiento local del VPS Hostinger.
- Guardar los audios en una carpeta protegida del servidor, por ejemplo `/var/www/routlis/storage/audio-assets`.
- Eliminar archivo o marcarlo como inactivo según configuración.
- Servir archivos de audio mediante endpoint protegido del backend o mediante Nginx con reglas de acceso.
- Validar MIME type.
- Validar tamaño máximo.
- Mantener una interfaz de storage para permitir migración futura a S3/R2 sin cambiar los módulos de audios.

Formatos permitidos:

```txt
audio/mpeg
audio/mp3
audio/wav
audio/x-wav
```

Tamaño máximo inicial sugerido:

```txt
20 MB por audio
```

### Audio Library Module

Responsabilidades:

- Subir audio.
- Guardar metadata.
- Listar audios.
- Editar metadata.
- Activar/desactivar audio.
- Eliminar audio lógico.

Endpoints sugeridos:

```txt
GET /audio-assets
POST /audio-assets
GET /audio-assets/:id
PATCH /audio-assets/:id
DELETE /audio-assets/:id
```

Notas:

- `DELETE` puede ser borrado lógico: `isActive = false`.
- No borrar físicamente el archivo en V1 salvo que se implemente con seguridad.

### Categories Module

Responsabilidades:

- Crear categorías.
- Editar categorías.
- Listar categorías activas.
- Ordenar categorías.
- Activar/desactivar categorías.

Endpoints sugeridos:

```txt
GET /audio-categories
POST /audio-categories
PATCH /audio-categories/:id
DELETE /audio-categories/:id
```

### Audio Buttons Module

Responsabilidades:

- Crear botón asociado a un audio.
- Asociar botón a categoría.
- Definir etiqueta, color, shortcut y orden.
- Activar/desactivar botón.
- Listar botones por categoría.
- Endpoint especial para cargar la botonera.

Endpoints sugeridos:

```txt
GET /audio-buttons
POST /audio-buttons
GET /audio-buttons/board
PATCH /audio-buttons/:id
DELETE /audio-buttons/:id
```

`GET /audio-buttons/board` debe devolver únicamente botones activos agrupados por categoría activa.

### Playback Module

Responsabilidades:

- Definir modo de reproducción.
- En V1 solo existe `LOCAL_BROWSER`.
- Registrar evento de inicio.
- Registrar evento de finalización o detención.
- Preparar arquitectura para futuros modos.

Modos futuros previstos:

```txt
LOCAL_BROWSER
WHATSAPP_AUDIO_SEND
CHATWOOT_AUDIO_SEND
CALL_INJECTION
SIP_PLAYBACK
```

Endpoints sugeridos:

```txt
POST /playback-events/start
PATCH /playback-events/:id/stop
```

### Audit Module

Responsabilidades:

- Consultar historial de reproducciones.
- Filtrar por usuario.
- Filtrar por audio.
- Filtrar por fecha.
- Filtrar por categoría.

Endpoint sugerido:

```txt
GET /audit/playback-events
```

---

## 14. Frontend — pantallas requeridas

### Login

Ruta:

```txt
/login
```

Debe permitir:

- Ingresar email.
- Ingresar contraseña.
- Mostrar errores.
- Redirigir según rol.

### Botonera

Ruta:

```txt
/board
```

Debe mostrar:

- Categorías activas.
- Botones activos.
- Buscador de audio.
- Audio actualmente activo.
- Botón detener.
- Botón pausar/reanudar opcional.
- Estado visual del botón que está sonando.

Reglas:

- No pueden sonar dos audios al mismo tiempo.
- Si se presiona otro audio, se detiene el anterior y se reproduce el nuevo.
- Al iniciar reproducción, llamar al backend para registrar evento.
- Al detener, llamar al backend para cerrar evento.
- Al terminar naturalmente el audio, registrar finalización.

Layout sugerido:

```txt
┌─────────────────────────────────────────────┐
│ Routlis AudioBoard                          │
│ Buscar audio...                             │
├─────────────────────────────────────────────┤
│ SALUDOS                                     │
│ [Saludo inicial] [Presentación] [Bienvenida]│
│                                             │
│ VALIDACIÓN                                  │
│ [¿Es titular?] [Autorización de datos]      │
│                                             │
│ INFORMACIÓN                                 │
│ [Estado de cuenta] [Recordatorio]           │
│                                             │
│ CIERRE                                      │
│ [Gracias] [Canales] [Despedida]             │
├─────────────────────────────────────────────┤
│ Reproduciendo: Saludo inicial               │
│ [Pausar] [Detener]                          │
└─────────────────────────────────────────────┘
```

### Administración de audios

Ruta:

```txt
/admin/audios
```

Debe permitir:

- Listar audios.
- Subir nuevo audio.
- Ver nombre, duración, tamaño y estado.
- Editar metadata.
- Activar/desactivar.
- Eliminar lógicamente.

### Administración de categorías

Ruta:

```txt
/admin/categories
```

Debe permitir:

- Crear categoría.
- Editar categoría.
- Definir orden.
- Activar/desactivar.

### Administración de botones

Ruta:

```txt
/admin/buttons
```

Debe permitir:

- Crear botón.
- Seleccionar audio.
- Seleccionar categoría.
- Definir label.
- Definir color opcional.
- Definir shortcut opcional.
- Definir orden.
- Activar/desactivar.

### Administración de usuarios

Ruta:

```txt
/admin/users
```

Debe permitir:

- Crear usuario.
- Listar usuarios.
- Asignar rol.
- Activar/desactivar usuario.

### Historial

Ruta:

```txt
/admin/history
```

Debe permitir:

- Ver usuario.
- Ver audio.
- Ver botón.
- Ver categoría.
- Ver fecha/hora de inicio.
- Ver fecha/hora de finalización.
- Ver duración reproducida.
- Filtrar por usuario, audio y fecha.

---

## 15. Comportamiento del reproductor local

Implementar un hook en frontend:

```txt
useAudioPlayback()
```

Responsabilidades:

- Mantener audio activo.
- Reproducir audio.
- Detener audio.
- Pausar audio.
- Reanudar audio.
- Detectar fin natural.
- Evitar reproducción simultánea.
- Crear evento de reproducción en backend.
- Actualizar evento al detener/finalizar.

Firma conceptual:

```ts
type PlaybackState = {
  activeButtonId: string | null;
  activeAudioUrl: string | null;
  activeEventId: string | null;
  isPlaying: boolean;
  isPaused: boolean;
};

function useAudioPlayback() {
  return {
    state,
    playButton,
    stop,
    pause,
    resume,
  };
}
```

---

## 16. Seguridad

Requisitos:

- Contraseñas hasheadas.
- JWT en cookie httpOnly.
- CORS configurado correctamente.
- Validación de DTOs.
- Validación de permisos por endpoint.
- Validación de organización en cada consulta.
- Un usuario solo puede acceder a datos de su organización.
- Los operadores no pueden acceder a endpoints administrativos.
- Los archivos de audio no deben ser manipulables por usuarios sin permisos.
- Limitar formatos y tamaño de audio.

---

## 17. Separación multiempresa

Aunque en V1 solo exista una organización, toda tabla operativa debe incluir:

```txt
organizationId
```

Aplicar esto en:

```txt
audio_assets
audio_categories
audio_buttons
playback_events
organization_members
```

Cada consulta debe filtrar por `organizationId`.

---

## 18. Seed inicial

Crear seed con:

### Organización

```txt
Routlis Demo Organization
```

### Roles

```txt
OWNER
ADMIN
SUPERVISOR
OPERATOR
```

### Permisos

Todos los permisos definidos en este documento.

### Usuario inicial

```txt
Email: admin@routlis.local
Password: Admin123*
Rol: OWNER
```

La contraseña debe poder cambiarse por variable de entorno o mostrarse solo en entorno local.

### Categorías iniciales

```txt
Saludos
Validación
Información
Objeciones
Cierre
```

---

## 19. Variables de entorno

### Backend

```env
DATABASE_URL=

JWT_SECRET=
JWT_EXPIRES_IN=1d

COOKIE_NAME=routlis_token
COOKIE_SECURE=false

STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/var/www/routlis/storage
LOCAL_AUDIO_PATH=/var/www/routlis/storage/audio-assets
PUBLIC_AUDIO_BASE_URL=http://localhost:4000/files/audio-assets

FRONTEND_URL=http://localhost:3000
PORT=4000
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 20. Docker para desarrollo

Crear `docker-compose.yml` para desarrollo local con:

```txt
PostgreSQL
Backend NestJS
Frontend Next.js
```

Redis no es obligatorio en V1.

Opcionalmente se puede agregar un volumen Docker local para simular la carpeta de almacenamiento del VPS.

---

## 21. Criterios de aceptación principales

### Login

- El usuario puede iniciar sesión con email y contraseña.
- El sistema rechaza credenciales inválidas.
- El usuario no autenticado no puede entrar a `/board` ni `/admin`.

### RBAC

- OPERATOR puede usar la botonera.
- OPERATOR no puede crear, editar ni eliminar audios.
- ADMIN puede gestionar audios, categorías y botones.
- SUPERVISOR puede ver historial.
- OWNER puede hacer todo.

### Audios

- ADMIN puede subir MP3/WAV.
- El sistema rechaza otros formatos.
- El sistema guarda el archivo en el almacenamiento local del VPS Hostinger.
- El sistema guarda metadata en PostgreSQL.

### Botonera

- El operador ve botones activos agrupados por categoría.
- El operador puede buscar audios.
- Al hacer clic en un botón, el audio se reproduce.
- No pueden sonar dos audios al mismo tiempo.
- El botón activo se resalta.
- El operador puede detener el audio.
- El sistema registra la reproducción.

### Historial

- Cada reproducción queda registrada.
- Al detener o finalizar el audio, se actualiza el evento.
- ADMIN/SUPERVISOR pueden consultar historial.

---

## 22. Preparación para V2

Aunque no se implemente en V1, dejar preparada la arquitectura para estos módulos:

```txt
whatsapp-gateway
chatwoot-integration
contacts
campaigns
voice-calls
analytics
billing
jobs
```

Especialmente importante:

El módulo `playback` debe estar diseñado para soportar estrategias futuras.

En V1:

```txt
LOCAL_BROWSER
```

Futuro:

```txt
WHATSAPP_AUDIO_SEND
CHATWOOT_AUDIO_SEND
CALL_INJECTION
```

No acoplar el componente `AudioButton` directamente al método de reproducción. Debe llamar a una abstracción o hook de playback.

---

## 23. Principio de arquitectura

Aplicar esta separación conceptual:

```txt
AudioAsset = archivo de audio y metadata.
AudioButton = botón visible que invoca un audio.
AudioCategory = agrupación visual/operativa.
Playback = forma de ejecutar el audio.
PlaybackEvent = registro de lo ocurrido.
```

No mezclar estas responsabilidades.

---

## 24. Resultado esperado

Al finalizar la V1 debe existir una aplicación funcional donde:

1. Un administrador inicia sesión.
2. Crea categorías.
3. Sube audios.
4. Crea botones asociados a esos audios.
5. Un operador entra a la botonera.
6. El operador reproduce audios localmente desde el navegador.
7. El sistema evita superposición de audios.
8. El sistema registra cada reproducción.
9. Un supervisor o administrador consulta el historial.
10. Todo funciona separado por organización y protegido por RBAC.

---

## 25. Instrucción de desarrollo para Claude

Desarrolla **Routlis V1 Proyecto (Botonera Modular de Audios)** siguiendo buenas prácticas de arquitectura modular, TypeScript estricto, DTOs validados, separación de responsabilidades, componentes reutilizables y diseño limpio con Tailwind CSS.

Prioriza funcionalidad estable y código mantenible sobre complejidad innecesaria.

No implementar WhatsApp, Chatwoot, llamadas, Redis ni campañas en esta V1, pero dejar la arquitectura preparada para integrarlos posteriormente.

Genera primero:

1. La estructura de carpetas.
2. El `schema.prisma`.
3. Los módulos NestJS base.
4. El seed inicial.
5. Los endpoints principales.
6. Las pantallas frontend.
7. El hook `useAudioPlayback`.
8. La integración básica entre frontend y backend.
