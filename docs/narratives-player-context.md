# Narratives Player Context

## Objetivo general
Evolucionar el player de Narratives desde una pantalla lineal de ejecución a un canvas read-only guiado, basado en la versión publicada del grafo, sin introducir capacidades de edición del builder.

## Estado inicial del player
- El player actual vive en `frontend/src/components/narratives/player/NarrativePlayer.tsx`.
- La pantalla de entrada está en `frontend/src/app/narratives/page.tsx`.
- La pantalla de ejecución está en `frontend/src/app/narratives/[id]/run/page.tsx`.
- La ejecución usa `GET /narrative-runs/:id`, `POST /narratives/:id/runs`, `POST /narrative-runs/:id/events`, `PATCH /narrative-runs/:id/current-node`, `POST /narrative-runs/:id/complete` y `POST /narrative-runs/:id/cancel`.
- La UI actual es lineal y muestra:
  - narrativa en ejecución
  - paso actual
  - resumen
  - ruta
  - actividad
  - acciones de siguiente, omitir, finalizar y cancelar

## Baseline actual incluido
- Fix de arranque del player para evitar múltiples `RUNNING` al entrar en `/run`.
- Cambio en `/narratives` para crear la ejecución desde el botón `Iniciar` y navegar con `?run=...`.
- Endpoint `GET /audio-buttons/:id` agregado para que `AUDIO_BUTTON` pueda resolver su detalle en el player.

## Nueva visión del player
- Canvas read-only sobre el grafo publicado.
- Zoom, pan, fit view inicial y centrado del nodo actual.
- Nodo actual claramente resaltado.
- Operación guiada nodo a nodo.
- Panel lateral derecho para ejecutar acciones sobre el nodo actual o seleccionado.

## Archivos revisados
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `frontend/src/app/narratives/page.tsx`
- `frontend/src/app/narratives/[id]/run/page.tsx`
- `frontend/src/types/narratives.ts`
- `backend/src/modules/narratives/narratives.controller.ts`
- `backend/src/modules/narratives/narratives.service.ts`
- `backend/src/modules/narrative-runs/narrative-runs.service.ts`
- `backend/src/modules/audio-buttons/audio-buttons.controller.ts`
- `backend/src/modules/audio-buttons/audio-buttons.service.ts`

## Decisiones técnicas tomadas
- Base visual: `@xyflow/react`, ya usado por el builder.
- El player seguirá siendo el entrypoint de ejecución; no se crea una pantalla paralela.
- El canvas será estrictamente read-only.
- El panel contextual del player estará a la derecha en v1.
- La compatibilidad de `DECISION` seguirá apoyándose en `edges.label` y opciones legacy.

## Riesgos detectados
- El player actual mezcla lógica de ejecución y presentación en un componente grande.
- `AUDIO_BUTTON` depende de una lectura adicional y puede fallar si el recurso asociado no existe o está inactivo.
- Los eventos actuales no cubren todos los estados visuales deseados; parte del estado deberá derivarse en frontend.
- Hay cambios recientes del player que todavía forman parte del baseline y deben preservarse durante la refactorización.

## Compatibilidad
- No romper:
  - builder
  - runs actuales
  - grafos publicados existentes
  - reproducción de audio actual
  - audio buttons actuales
  - decisiones legacy

## Trabajo por hito
### Hito 0
- Documentación inicial y baseline de trabajo.

### Hito 1
- Se incorpora un canvas read-only de React Flow dentro del player.
- El canvas usa el grafo publicado y conserva la lógica actual de ejecución.
- Se agregan `fitView`, `MiniMap`, `Controls` y botón `Centrar paso actual`.

### Trabajo en progreso
- Validar y consolidar Hito 1 como commit aislado.

## Cómo continuar si se corta la sesión
1. Confirmar rama actual: `feature/narratives-player-canvas`.
2. Leer este archivo y `docs/narratives-player-implementation-log.md`.
3. Revisar `git status`.
4. Continuar desde el próximo hito recomendado.

## Último commit realizado
- `9cdeb91` `docs(narratives-player): add canvas player implementation context`

## Último push realizado
- `origin/feature/narratives-player-canvas` después de `9cdeb91`

## Próximo hito recomendado
- `Hito 2`: derivar estados visuales de nodos y aristas desde `run.currentNodeId` y `run.events`.

## Comandos útiles
- `git status --short --branch`
- `npm --prefix frontend run build`
- `npm --prefix frontend run lint`
- `npm --prefix backend run build`
- `npm --prefix backend test`
- `docker compose up -d --build frontend backend`

## Qué no se toca en esta fase
- Builder
- Nuevos tipos de nodo
- Subflows
- Analytics avanzados
- Reescritura total del backend
