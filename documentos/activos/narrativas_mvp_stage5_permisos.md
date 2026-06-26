# Llamadas MVP - Etapa 5

Fecha: 2026-06-12

## Estado

Se reforzó la etapa 5 de Llamadas con foco en permisos y experiencia segura:

- El backend ya protege las rutas de Llamadas con `PermissionsGuard`.
- El frontend ya oculta la navegación según permisos y roles.
- El player narrativo ahora maneja mejor errores de autenticación y autorización.
- La navegación para operator quedó visible solo para `narratives:run`.

## Cambios aplicados en esta etapa

- Se alineó la navegación global para mostrar `Llamadas` solo a quienes tienen permiso.
- Se reforzó el player para responder mejor ante `401` y `403`.
- Se validó que el build de frontend y backend siga pasando.

## Resultado

La etapa 5 quedó lista como base de endurecimiento antes de seguir con pruebas funcionales más finas o pasar cambios a `principal`.

## Pendiente

- Revisar mensajes de error más específicos por escenario si aparecen en QA.
- Hacer prueba manual completa:
  - ADMIN crea/publica narrativa.
  - OPERATOR ejecuta narrativa.
  - usuario sin permiso queda restringido.
