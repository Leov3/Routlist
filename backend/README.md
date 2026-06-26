# Routlis Backend

API principal de Routlis V1 AudioBoard construida con NestJS.

## Qué expone

- Autenticación con JWT en cookie httpOnly.
- RBAC por roles y permisos.
- Usuarios, organizaciones y sesiones.
- `OWNER` como super admin global para operaciones internas.
- Biblioteca de audios.
- Categorías y botones de audio.
- Streaming protegido de audio.
- Playback events e historial.
- Storage local protegido.
- Integraciones por organización, incluyendo ElevenLabs para configuración segura de TTS.

## Requisitos

- Node.js y npm.
- PostgreSQL local o accesible por red.

## Desarrollo

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run start:dev
```

La API queda disponible en:

```txt
http://localhost:4000
```

## Documentación de API

- `http://localhost:4000/docs`
- `http://localhost:4000/docs-json`

## Build

```bash
npm run build
```

## Notas

- Los archivos servidos por la API requieren sesión válida.
- Las rutas sensibles respetan `organizationId`.
- `ADMIN`, `SUPERVISOR` y `OPERATOR` solo operan dentro de su organización activa.
- `OWNER` puede listar organizaciones, crear nuevas, deshabilitarlas y cambiar la organización activa de su sesión.
- El storage y los archivos de audio siguen separados por organización.
- El storage no expone contenido sin control de acceso.
- `GET /health/storage` solo responde para `OWNER`.
- Las integraciones externas se guardan por organización y usan secretos cifrados en backend.

## Integraciones

- `GET /integrations/elevenlabs/settings`
- `PATCH /integrations/elevenlabs/settings`
- `POST /integrations/elevenlabs/test`
- `GET /integrations/elevenlabs/voices`
- `POST /integrations/elevenlabs/generate-test`
- `DELETE /integrations/elevenlabs/settings`

La clave de cifrado de integraciones se define con `INTEGRATION_ENCRYPTION_KEY`.

## Endpoints relevantes para multitenancy

- `GET /organizations`
- `POST /organizations`
- `PATCH /organizations/:id`
- `GET /organizations/current`
- `POST /auth/switch-organization`
