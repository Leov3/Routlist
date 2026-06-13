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
Commit: pendiente
Push: pendiente
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
- Commit y push del Hito 1.
- Integración de Hito 1 a `dev`.
Próximo hito:
- Hito 2
