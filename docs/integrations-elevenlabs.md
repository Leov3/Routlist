# Integración ElevenLabs

## Alcance

La integración de ElevenLabs en Routlis se administra desde `/admin/integraciones`.
La configuración es por organización, no global, y cada organización mantiene su propia API key y defaults.

## Persistencia

- La configuración se guarda en PostgreSQL en `ElevenLabsIntegrationSetting`.
- El registro está asociado a `organizationId` con una restricción única.
- La API key se guarda cifrada en backend.
- El frontend nunca recibe la key completa.

## Flujo operativo

- Obtener estado y configuración: `GET /integrations/elevenlabs/settings`
- Guardar configuración: `PATCH /integrations/elevenlabs/settings`
- Probar conexión: `POST /integrations/elevenlabs/test`
- Listar voces: `GET /integrations/elevenlabs/voices`
- Generar audio de prueba: `POST /integrations/elevenlabs/generate-test`
- Desconectar: `DELETE /integrations/elevenlabs/settings`

## Variables de entorno

- `INTEGRATION_ENCRYPTION_KEY` cifra y descifra secretos de integraciones.
- Si esta clave cambia, los secretos ya almacenados no podrán descifrarse con la nueva clave.

## Nota de despliegue

Los deploys normales no borran esta configuración si se conserva la base de datos y sus volúmenes.
Solo se pierde o deja de ser legible si se borra el volumen de PostgreSQL, se recrea la base o se cambia la clave de cifrado.
