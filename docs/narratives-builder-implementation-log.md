# Narratives Builder Implementation Log

## Hito 0

Fecha: 2026-06-13
Rama: `feature/narratives-builder-upgrade`
Commit: pendiente
Push: `origin/feature/narratives-builder-upgrade`, luego merge a `dev`
Resumen:
- Se revisó el estado del repositorio y se confirmó base limpia sobre `dev`.
- Se creó la rama `feature/narratives-builder-upgrade`.
- Se documentó el estado inicial del módulo Narratives Builder.
- Se dejó definido el flujo por hitos con integración posterior a `dev`.
Archivos modificados:
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`
Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix backend run build`
Resultado de checks:
- `frontend build`: OK
- `backend build`: OK
Riesgos:
- Contrato actual de validación muy básico para el Hito 2.
- `DECISION.options` sigue en formato legacy.
- `FlowNodeData` requiere limpieza posterior, no inmediata.
Pendientes:
- Ninguno dentro del alcance del hito.
Próximo hito:
- Hito 1

## Hito 1

Fecha: 2026-06-13
Rama: `feature/narratives-builder-upgrade`
Commit: `6416afd`
Push: `origin/feature/narratives-builder-upgrade`, luego merge a `dev`
Resumen:
- Se enriquecieron las tarjetas de nodos con resúmenes útiles y badges visuales.
- La cabecera del builder ahora expone estado de borrador, publicación y validación.
- El panel de estado lateral ahora muestra narrativa, versión, publicación, nodos y conexiones.
- Se sustituyeron IDs por nombres visibles de audio y botón cuando los recursos están disponibles.
- La selección inicial del canvas dejó de marcar todos los nodos al cargar.
Archivos modificados:
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`
Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint -- src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
Resultado de checks:
- `frontend build`: OK
- `frontend lint` sobre el archivo del builder: OK
Riesgos:
- Los badges de estado del nodo usan heurísticas locales del frontend; todavía no existe un modelo enriquecido de issues compartido con backend.
- `DECISION.options` sigue siendo legacy y solo se normaliza para mostrar mejor el resumen.
Pendientes:
- Ninguno dentro del alcance del hito.
Próximo hito:
- Hito 2

## Hito 2

Fecha: 2026-06-13
Rama: `feature/narratives-builder-upgrade`
Commit: `ef9daf5` en feature, `0f91d88` en `dev`
Push: `origin/feature/narratives-builder-upgrade`, `origin/dev`
Resumen:
- Se añadió un panel de validación con errores, advertencias y sugerencias.
- Cada issue permite centrar el canvas en el nodo afectado.
- Cada issue con nodo asociado permite abrir el modal de edición.
- Se incorporó validación local estructurada para mejorar la experiencia del builder.
- Los errores planos del backend se traducen a issues accionables cuando es posible.
Archivos modificados:
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`
Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint -- src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
Resultado de checks:
- `frontend build`: OK
- `frontend lint` sobre el archivo del builder: OK
Riesgos:
- La clasificación de issues todavía vive en frontend y debe consolidarse en un contrato compartido más adelante.
- Algunas inferencias de errores del backend siguen siendo heurísticas basadas en texto.
Pendientes:
- Ninguno dentro del alcance del hito.
Próximo hito:
- Hito 3

## Hito 3

Fecha: 2026-06-13
Rama: `feature/narratives-builder-upgrade`
Commit: `e7ae699` en feature, `f7ada79` en `dev`
Push: `origin/feature/narratives-builder-upgrade`, `origin/dev`
Resumen:
- Se reorganizó el modal por secciones lógicas para cada tipo de nodo.
- Se añadió un bloque de validación contextual dentro del popup.
- `AUDIO` y `AUDIO_BUTTON` muestran el recurso actualmente asociado dentro del modal.
- La configuración sigue en popup tipo n8n, sin inspector lateral.
Archivos modificados:
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`
Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint -- src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
Resultado de checks:
- `frontend build`: OK
- `frontend lint` sobre el archivo del builder: OK
Riesgos:
- El modal sigue editando el contrato legacy del nodo; la normalización profunda queda para hitos posteriores.
- `DECISION` todavía usa edición de opciones por texto separado por `|`.
Pendientes:
- Ninguno dentro del alcance del hito.
Próximo hito:
- Hito 4

## Hito 4

Fecha: 2026-06-13
Rama: `feature/narratives-builder-upgrade`
Commit: pendiente
Push: pendiente
Resumen:
- Se normalizó `DECISION.options` a objetos con `id`, `label` y `description`.
- El builder mantiene compatibilidad con formatos legacy previos.
- El modal de `DECISION` ahora soporta agregar, editar, eliminar y reordenar opciones.
- Las opciones y las rutas siguen compatibles con el player actual mediante `edge.label`.
- La validación ahora detecta desalineaciones entre opciones y rutas conectadas.
Archivos modificados:
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`
Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint -- src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
Resultado de checks:
- `frontend build`: OK
- `frontend lint` sobre el archivo del builder: OK
Riesgos:
- La relación opción-ruta sigue siendo implícita por `edge.label`, no por `sourceOptionId`.
- El backend todavía no valida estructura enriquecida de opciones, solo la forma general del grafo.
Pendientes:
- Commit y push del Hito 4.
- Integración de Hito 4 a `dev`.
Próximo hito:
- Hito 5

## Hito 5

Fecha: 2026-06-13
Rama: `feature/narratives-builder-upgrade`
Commit: pendiente
Push: pendiente
Resumen:
- Se endureció la publicación desde el builder.
- La publicación ahora se bloquea con errores críticos.
- Si solo hay advertencias o sugerencias, se pide confirmación.
- Se añadió un diff básico contra la versión publicada dentro del panel.
Archivos modificados:
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`
Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint -- src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
Resultado de checks:
- `frontend build`: OK
- `frontend lint` sobre el archivo del builder: OK
Riesgos:
- El diff es básico y está basado en comparación por ids/contenido serializado.
Pendientes:
- Commit y push del Hito 5.
- Integración de Hito 5 a `dev`.
Próximo hito:
- Hito 6
