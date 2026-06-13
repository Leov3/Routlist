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

### Hito 2
- Se derivan estados visuales de nodos y aristas desde `run.currentNodeId` y `run.events`.
- Los nodos ahora distinguen `current`, `completed`, `available`, `locked`, `skipped`, `error` y `decision-selected`.
- Las aristas distinguen `active`, `traversed`, `pending` y `not-taken`.

### Hito 3
- El player ahora prioriza un panel lateral contextual ligado al nodo seleccionado en el canvas.
- Si no hay selección explícita, el panel usa el nodo actual de la ejecución.
- Los nodos bloqueados muestran explicación de acceso restringido.
- Los nodos fuera del paso actual quedan en modo consulta, sin ejecutar acciones.
- La actividad reciente se mueve a un bloque separado para no competir con el canvas.

### Hito 4
- `AUDIO` y `AUDIO_BUTTON` operan desde el panel contextual.
- Se muestran badges operativos, descripción, notas y estado del recurso.
- `AUDIO_BUTTON` ahora expone mejor su categoría, audio asociado y error de carga si el recurso falta.

### Hito 5
- `SCRIPT_TEXT` permite copia directa del texto y muestra notas contextuales.
- `INSTRUCTION` queda visualmente separado como acción operativa.
- `PAUSE` muestra temporizador cuando aplica y fallback manual cuando la duración no es válida.

### Hito 6
- `DECISION` usa labels de aristas y opciones legacy para presentar rutas accionables.
- Al avanzar, el panel vuelve al nodo actual y el canvas recentra el flujo.
- La decisión seleccionada deja feedback visible en el panel y en las aristas.
- Commit: `33b4685` (feat: complete decision and end canvas flow)

### Hito 7
- El cierre exitoso queda restringido al nodo `END`.
- El panel de `END` informa explícitamente cuándo la ejecución ya puede completarse.
- Commit: `33b4685` / `18e3b9d`

### Hito 8
- Refactorización para remover el sidebar fijo lateral y priorizar el menú contextual por clic secundario en nodos.
- Ajuste responsive básico del canvas.
- Commit: `e7b5223` (refactor: remove fixed action sidebar)

### Hito 9
- Se añade la animación `fadeIn` al menú contextual del canvas.
- Los nodos reciben un halo de selección (`ring-2 ring-primary`) y escalado interactivo en hover.
- Se implementan banners de estado de corrida altamente visibles sobre el canvas para `END` listo, `COMPLETED` y `CANCELLED`.
- Commit: Pendiente (Pulido final)

## Cómo continuar si se corta la sesión
1. Confirmar rama actual: `dev`.
2. Leer este archivo y `docs/narratives-player-implementation-log.md`.
3. Revisar `git status`.
4. Continuar desde el próximo hito recomendado.

## Último commit realizado
- `d8172db` `feat(narratives-player): wire contextual node actions` (y los commits subsecuentes del pulido final)

## Último push realizado
- `origin/dev`

## Próximo hito recomendado
- Validación manual en Docker local del pulido específico de nodos del player.

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

## UI/UX Polish Branch
- Rama activa para polish visual: `feature/narratives-player-ui-polish`.
- En esta fase no se cambia la lógica de runs ni contratos backend.
- Estado actual aplicado sobre esta rama:
  - header operativo compacto sin títulos redundantes
  - canvas más alto y protagonista
  - controles flotantes dark
  - minimap oculto
  - dock inferior compacto para leyenda, estado y actividad
  - nodos `START`, `END`, `SCRIPT_TEXT`, `INSTRUCTION`, `AUDIO`, `AUDIO_BUTTON`, `PAUSE` y `DECISION` con mayor expresividad visual
  - botón de tres puntos en nodos para abrir acciones como fallback al clic derecho
  - labels de aristas como chips dark en lugar de etiquetas blancas

## Node Widget Polish
- Rama activa: `dev`.
- Alcance aplicado: únicamente nodos del player canvas y su popover contextual.
- No se tocaron builder, backend, contratos de grafo ni layout general del player.
- Cambios aplicados:
  - `START` y `END` ahora se leen como inicio/cierre operativos, con badge de estado.
  - `AUDIO` se presenta como mini reproductor con CTA visible cuando es el paso actual.
  - `AUDIO_BUTTON` se presenta como botón de botonera, con label/categoría y CTA de reproducción.
  - `SCRIPT_TEXT` se presenta como guion legible, copiable y con CTA `Leído`.
  - `INSTRUCTION` se presenta como nota/post-it operativo con CTA `Entendido`.
  - `PAUSE` muestra manual/timer y CTA `Continuar`.
  - `DECISION` muestra opciones como chips accionables cuando es el nodo actual.
  - El popover reduce metadata técnica y prioriza contenido, acciones y notas.
- Checks:
  - `npm --prefix frontend run build` completado correctamente.
- Último commit:
  - `cdf898e` `feat(narratives-player): polish execution node widgets`
