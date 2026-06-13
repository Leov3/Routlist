# Narrativas MVP - Etapa 2 frontend

Estado actual:
- Se añadió la experiencia administrativa de Narrativas.
- Ya existen:
  - listado de narrativas en `/admin/narratives`
  - creación en `/admin/narratives/new`
  - builder visual en `/admin/narratives/[id]/builder`
- El sidebar de Routlis ya muestra Narrativas dentro del panel de control.
- El build del frontend pasa correctamente.

Pendientes siguientes:
- Player guiado para operador.
- Rutas públicas de ejecución de narrativa.
- Reporte de ejecución y eventos.

Notas técnicas:
- Se usa `@xyflow/react` para el canvas.
- El builder guarda y valida el `graphJson` de la narrativa.
- El acceso quedó protegido con `narratives:view`, `narratives:create` y `narratives:update`.
