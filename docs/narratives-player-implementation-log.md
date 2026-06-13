# Narratives Player Implementation Log

## Hito 0

Fecha:
2026-06-13

Rama:
feature/narratives-player-canvas

Commit:
9cdeb91

Push:
origin/feature/narratives-player-canvas

Resumen:
Se documenta el estado real del player, el baseline actual del workspace y la dirección técnica del canvas read-only guiado.

Archivos modificados:
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- Exploración de `git status`
- Revisión de player, builder, run page y package scripts

Resultado:
- Baseline confirmado.
- Dependencia de React Flow ya disponible.
- Cambios recientes del player incluidos en el punto de partida.

Riesgos:
- El player actual es grande y mezcla lógica y UI.
- El estado visual del grafo requerirá derivación desde `run.events`.

Pendientes:
- Ejecutar Hito 1.

Próximo hito:
- `feat(narratives-player): add read-only canvas view`

## Hito 1

Fecha:
2026-06-13

Rama:
feature/narratives-player-canvas

Commit:
a9db25f

Push:
origin/feature/narratives-player-canvas

Resumen:
Se agrega un canvas read-only basado en React Flow sobre el grafo publicado, manteniendo el player actual funcional como soporte operativo inicial.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `frontend/src/app/narratives/page.tsx`
- `frontend/src/app/narratives/[id]/run/page.tsx`
- `backend/src/modules/audio-buttons/audio-buttons.controller.ts`
- `backend/src/modules/audio-buttons/audio-buttons.service.ts`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`
- `npm --prefix backend run build`

Resultado:
- Canvas read-only base compilado.
- `Iniciar` navega con `?run=...`.
- `AUDIO_BUTTON` ya puede resolver detalle por endpoint dedicado.

Riesgos:
- El panel contextual todavía no está separado del bloque lineal.
- Los estados del canvas aún son mínimos (`current`, `completed`, `pending`).

Pendientes:
- Evolucionar estados visuales del flujo.

Próximo hito:
- `feat(narratives-player): add guided node and edge states`

## Hito 2

Fecha:
2026-06-13

Rama:
feature/narratives-player-canvas

Commit:
79a0149

Push:
origin/feature/narratives-player-canvas

Resumen:
Se agregan estados guiados del flujo para nodos y aristas a partir de la ejecución real, incluyendo decisiones tomadas, nodos omitidos y rutas activas o no tomadas.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El canvas refleja estado operativo del flujo.
- Las decisiones tomadas afectan visualmente las rutas del grafo.

Riesgos:
- La selección manual de nodos todavía no controla el contenido mostrado.
- El panel contextual sigue siendo el bloque lineal existente.

Pendientes:
- Separar la operación del nodo seleccionado en un panel lateral contextual.

Próximo hito:
- `feat(narratives-player): add contextual node action panel`

## Hito 3

Fecha:
2026-06-13

Rama:
feature/narratives-player-canvas

Commit:
3d544c0

Push:
origin/feature/narratives-player-canvas

Resumen:
Se reemplaza el bloque lineal principal de ejecución por un panel lateral contextual asociado al nodo seleccionado o al nodo actual del flujo.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El canvas ya controla la selección de nodos.
- El panel contextual separa revisión y ejecución.
- La actividad reciente queda desacoplada del área principal.

Riesgos:
- El panel todavía comparte parte de la lógica específica de audio y texto que se refinará en los hitos siguientes.

Pendientes:
- Completar el detalle operativo de `AUDIO` y `AUDIO_BUTTON`.

Próximo hito:
- `feat(narratives-player): support audio and audio button actions in canvas`

## Hito 4

Fecha:
2026-06-13

Rama:
feature/narratives-player-canvas

Commit:
Pendiente

Push:
Pendiente

Resumen:
Se refuerza la operación contextual de `AUDIO` y `AUDIO_BUTTON` con metadata visible, notas y mensajes claros de recurso faltante o inaccesible.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El panel contextual ya trata audio como recurso operativo real y no solo como acción mínima.
- `AUDIO_BUTTON` muestra mejor su contexto y falla de forma explícita si no resuelve detalle.

Riesgos:
- La lógica de eventos de audio sigue siendo la base previa y todavía no emite pausas o stops como eventos persistidos.

Pendientes:
- Cerrar `SCRIPT_TEXT`, `INSTRUCTION` y `PAUSE` con la misma profundidad operativa.

Próximo hito:
- `feat(narratives-player): support text instruction and pause nodes`

## Hito 5

Fecha:
2026-06-13

Rama:
feature/narratives-player-canvas

Commit:
Pendiente

Push:
Pendiente

Resumen:
Pendiente.

Archivos modificados:
- Pendiente

Checks ejecutados:
- Pendiente

Resultado:
- Pendiente

Riesgos:
- Pendiente

Pendientes:
- Implementar Hito 5.

Próximo hito:
- `feat(narratives-player): support text instruction and pause nodes`
