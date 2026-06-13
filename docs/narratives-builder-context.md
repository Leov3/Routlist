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
- Hito 0 completado y respaldado en feature + `dev`.
- Hito 1 completado y respaldado en feature + `dev`.
- Hito 2 completado y respaldado en feature + `dev`.
- Hito 3 completado y respaldado en feature + `dev`.
- Hito 4 completado y respaldado en feature + `dev`.
- Hito 5 implementado en la rama feature, pendiente de commit e integración a `dev`.
- Checks ejecutados sobre el estado actual:
  - `npm --prefix frontend run build`
  - `npm --prefix frontend run lint -- src/components/narratives/builder/NarrativeBuilderCanvas.tsx`
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
- `frontend/src/components/narratives/builder/NarrativeBuilderCanvas.tsx`

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

### Hito 1
- Se mejoran las tarjetas visuales de los nodos sin cambiar persistencia.
- Cada nodo ahora muestra resumen funcional y badges de estado.
- El canvas muestra estado visible del borrador:
  - narrativa
  - versión draft
  - versión publicada
  - cambios sin guardar
  - cambios sin publicar
  - resultado de validación
- Se reemplazan IDs crudos por nombres visibles de audio y botón cuando los recursos están cargados.
- La selección inicial tras cargar o copiar publicada ahora queda en el primer nodo, no en todos.

### Hito 2
- Se agrega un panel de validación estructurado con:
  - errores críticos
  - advertencias
  - sugerencias
- Cada issue puede:
  - enfocar el nodo en el canvas
  - abrir el modal del nodo
- Se añade una capa de validación local en frontend para UX administrativa.
- La validación remota del backend se sigue ejecutando y se incorpora al panel como respaldo.
- El builder ahora muestra conteos visibles de errores, advertencias y sugerencias.

### Hito 3
- Se reorganiza el modal por secciones lógicas:
  - configuración principal
  - contenido
  - recurso asociado
  - comportamiento
  - notas internas u operatorias
  - validación del nodo
- Cada tipo de nodo ahora presenta un popup más legible y orientado a administración.
- El modal incorpora un resumen de issues específicos del nodo en edición.
- Los nodos `AUDIO` y `AUDIO_BUTTON` muestran estado visible del recurso asociado dentro del modal.

### Hito 4
- `DECISION.options` ahora se normaliza a estructura compatible:
  - `id`
  - `label`
  - `description`
- El builder sigue leyendo formatos legacy:
  - string separado por `|`
  - arreglo simple
  - arreglo de objetos
- El modal de `DECISION` ahora permite:
  - agregar opciones
  - editar label
  - editar descripción
  - eliminar opciones
  - reordenar opciones
- Las rutas del `DECISION` siguen siendo compatibles con el player actual usando `edge.label`.
- El builder ahora valida cobertura entre opciones y labels de salidas existentes.

### Hito 5
- La publicación se bloquea si existen errores críticos.
- Si solo hay advertencias o sugerencias, el builder pide confirmación antes de publicar.
- Se muestra un diff básico contra la versión publicada:
  - nodos agregados
  - nodos modificados
  - nodos eliminados
  - rutas agregadas
  - rutas eliminadas

## Trabajo en progreso
- Commit, push e integración a `dev` del Hito 5.

## Pendientes
- Formalizar panel de validación con errores, advertencias y sugerencias.
- Añadir resúmenes visuales útiles por tipo de nodo en el canvas.
- Mejorar la visibilidad del estado de draft/publicada dentro del builder.
- Evaluar una fase posterior para `sourceOptionId` en edges si se necesita relación explícita opción-ruta.
- Reemplazar en una fase posterior la inferencia local/backend por un contrato de issues tipado y compartido.

## Riesgos detectados
- El backend sigue devolviendo `validation: { valid, errors[] }`; Hito 2 resuelve UX con una capa local, pero el contrato aún no es rico.
- `FlowNodeData` es laxo y hoy mezcla contratos de nodos distintos; la limpieza grande debe quedar para Hito 7.
- `PAUSE` tiene coexistencia de `pauseType` y `manual`; cualquier mejora debe respetar ambas formas por compatibilidad.
- `DECISION` todavía depende implícitamente de `edge.label` para alinear opciones y rutas; la relación aún no es explícita en el modelo.
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
- `072cb01` - `refactor(narratives): normalize decision options` en feature
- `9711da2` - `refactor(narratives): normalize decision options` en `dev`

## Último push realizado
- `feature/narratives-builder-upgrade` actualizada hasta `072cb01`.
- `dev` actualizado hasta `9711da2`.

## Próximo hito recomendado
- Cerrar Hito 5 en Git y pasar a Hito 6: productividad incremental del editor.

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
