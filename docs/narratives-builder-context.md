# Narratives Builder Context

## Objetivo general del trabajo
Mejorar el editor/builder de Narratives para administradores por hitos pequeños, integrando cada hito estable a `dev`, sin rediseñar el player y manteniendo compatibilidad con narrativas existentes.

## Estado inicial del módulo
- Base de trabajo: rama `dev`, limpia y alineada con `origin/dev` al iniciar este trabajo.
- Rama de implementación: `feature/narratives-builder-upgrade`.
- El builder actual ya soporta:
  - canvas con `ReactFlow`
  - `MiniMap`
  - auto-layout con `dagre`
  - modal de edición por nodo
  - selección múltiple y borrado en bloque
  - guardado, validación, copia de publicada y publicación desde toolbar
- El backend ya soporta:
  - narrativas versionadas
  - draft editable
  - versión publicada
  - validación estructural del grafo
  - validación de recursos `AUDIO` y `AUDIO_BUTTON`
  - publicación que congela draft y crea nuevo draft desde publicada

## Estado actual después del último hito
- Hito 0 en progreso documental.
- No hay cambios funcionales aplicados todavía.
- Builds base ejecutados sobre el estado inicial:
  - `npm --prefix frontend run build`
  - `npm --prefix backend run build`

## Archivos revisados
- `backend/src/modules/narratives/narratives.controller.ts`
- `backend/src/modules/narratives/narratives.service.ts`
- `backend/src/modules/narratives/narratives.types.ts`
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
- `frontend/src/types/narratives.ts`
- `frontend/package.json`
- `backend/package.json`

## Archivos modificados
- `docs/narratives-builder-context.md`
- `docs/narratives-builder-implementation-log.md`

## Decisiones técnicas tomadas
- Se trabaja desde `dev`, pero cada hito se implementa primero en `feature/narratives-builder-upgrade`.
- Cada hito debe quedar:
  - documentado
  - validado con checks aplicables
  - commiteado
  - empujado a GitHub
  - integrado a `dev`
- No se usa `force push`.
- No se toca `main`, `master` ni ramas equivalentes de producción.
- No se hará una reescritura del builder; se prioriza evolución incremental compatible.
- No se usará inspector lateral para configurar nodos; la edición sigue en modal.
- `backend lint` no se usa como check estándar porque corre con `--fix` y muta archivos.

## Arquitectura actual del builder
- El frontend carga `NarrativeBuilderState` desde `GET /narratives/:id/builder`.
- También consulta recursos auxiliares:
  - `/audio-assets`
  - `/audio-buttons`
- El estado principal del builder en frontend hoy incluye:
  - `builder`
  - `nodes`
  - `edges`
  - `selectedNodeIds`
  - `selectedNodeId`
  - `editingNodeId`
  - `validation`
- El grafo se persiste como JSON con:
  - `nodes[]`
  - `edges[]`
- Cada nodo del canvas se abre en modal con edición inline del `data`.
- La validación visible actual es básica y solo expone `valid` + `errors[]`.

## Estructura actual de nodos
- `START`
  - arranque único
  - sin configuración compleja
- `AUDIO`
  - usa `audioAssetId`
  - soporta `description`, `operatorNotes`, `required`, `allowReplay`
- `AUDIO_BUTTON`
  - usa `audioButtonId`
  - soporta `operatorNotes`, `required`
- `SCRIPT_TEXT`
  - soporta `body`, `notes`, `required`
- `INSTRUCTION`
  - soporta `instruction`, `notes`
- `PAUSE`
  - soporta `pauseType`, `durationSeconds`, `manual`
- `DECISION`
  - soporta `question`, `options`, `operatorNotes`
  - hoy `options` sigue siendo texto separado por `|`
- `END`
  - cierre del flujo

## Reglas actuales del grafo confirmadas
- Debe haber exactamente un `START`.
- Debe haber al menos un `END`.
- `START` no puede tener entradas.
- `START` debe tener al menos una salida.
- `END` no puede tener salidas.
- `DECISION` debe tener al menos dos salidas.
- Las salidas de `DECISION` deben estar etiquetadas.
- No se permiten ciclos en el MVP.
- No se permiten nodos inalcanzables desde `START`.
- `AUDIO` y `AUDIO_BUTTON` se validan contra recursos activos de la organización.

## Plan técnico por hitos
- Hito 0
  - documentación, contexto, checks base, rama feature, respaldo inicial
- Hito 1
  - mejoras visuales seguras del builder
  - tarjetas más informativas
  - badges de estado
  - barra superior con más contexto del borrador
- Hito 2
  - panel de validación clickeable con foco y edición de nodo
- Hito 3
  - mejora de modales por tipo de nodo
- Hito 4
  - normalización compatible de `DECISION.options`
- Hito 5
  - publicación más segura
- Hito 6
  - productividad incremental del editor
- Hito 7
  - limpieza de tipos y contratos legacy

## Cambios aplicados por hito
### Hito 0
- Se documenta el estado inicial del módulo.
- Se registra la estrategia por hitos y el flujo de integración a `dev`.

## Trabajo en progreso
- Implementar Hito 1 en `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`.

## Pendientes
- Formalizar panel de validación con errores, advertencias y sugerencias.
- Añadir resúmenes visuales útiles por tipo de nodo en el canvas.
- Mejorar la visibilidad del estado de draft/publicada dentro del builder.
- Normalizar `DECISION.options` sin romper datos legacy ni player.

## Riesgos detectados
- El builder actual usa `validation: { valid, errors[] }`; para Hito 2 hará falta una capa de issues enriquecidos en frontend o ampliar contrato en backend.
- `FlowNodeData` es laxo y hoy mezcla contratos de nodos distintos; la limpieza grande debe quedar para Hito 7.
- `PAUSE` tiene coexistencia de `pauseType` y `manual`; cualquier mejora debe respetar ambas formas por compatibilidad.
- `DECISION.options` sigue siendo string legacy; moverlo a estructura tipada sin capa intermedia rompería compatibilidad.
- El frontend hoy muestra IDs de audio y botón en varias vistas; Hito 1 debe preferir nombres sin alterar persistencia.

## Compatibilidad con narrativas existentes
- No se cambia el formato persistido del grafo en Hito 0.
- Se debe conservar compatibilidad con campos actuales:
  - `required`
  - `manual`
  - `pauseType`
  - `durationSeconds`
  - `options`
  - `body`
  - `notes`
  - `operatorNotes`
  - `audioAssetId`
  - `audioButtonId`
- El player no se rediseña en este frente.

## Qué NO se tocó
- Player avanzado
- Nuevos tipos de nodo
- Analytics
- Automatizaciones de ejecución
- Permisos SaaS
- Reescritura completa de backend o canvas

## Cómo continuar si la sesión se corta
1. Confirmar rama actual con `git status --short --branch`.
2. Revisar este archivo y `docs/narratives-builder-implementation-log.md`.
3. Ejecutar checks base:
   - `npm --prefix frontend run build`
   - `npm --prefix backend run build`
4. Continuar desde el hito marcado en “Próximo hito recomendado”.
5. Antes de commitear, actualizar ambos documentos con el estado real.

## Último commit realizado
- Pendiente en este hito.

## Último push realizado
- Pendiente en este hito.

## Próximo hito recomendado
- Hito 1: mejoras visuales seguras del editor.

## Comandos útiles para correr el proyecto
- `npm --prefix frontend run dev`
- `npm --prefix backend run start:dev`
- `docker compose up --build`

## Comandos útiles para lint
- `npm --prefix frontend run lint`
- `npm --prefix backend run lint`
Nota: el lint de backend usa `--fix`, así que no se toma como check pasivo estándar.

## Comandos útiles para tests
- `npm --prefix backend test`

## Comandos útiles para build
- `npm --prefix frontend run build`
- `npm --prefix backend run build`

