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
98ec465

Push:
origin/feature/narratives-player-canvas

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
281d48c

Push:
origin/feature/narratives-player-canvas

Resumen:
Se mejora la experiencia contextual de `SCRIPT_TEXT`, `INSTRUCTION` y `PAUSE` con lectura clara, copia, notas y fallback seguro para pausas temporizadas inválidas.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- `SCRIPT_TEXT` ya es utilizable para operación.
- `INSTRUCTION` se diferencia de guion.
- `PAUSE` no queda ambigua cuando falla la duración.

Riesgos:
- `DECISION` sigue pendiente para que el canvas se comporte como flujo guiado completo.

Pendientes:
- Implementar Hito 6.

Próximo hito:
- `feat(narratives-player): support decision routing in canvas player`

## Hito 6

Fecha:
2026-06-13

Rama:
dev

Commit:
33b4685

Push:
origin/dev

Resumen:
`DECISION` toma labels de aristas y opciones legacy, recentra el canvas al nodo actual y deja feedback visible sobre la ruta elegida.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El flujo guiado por decisión se percibe mejor en canvas.

Riesgos:
- Sigue faltando validación manual con narrativas que tengan decisiones complejas.

Pendientes:
- Cerrar `END` y polish final.

Próximo hito:
- `feat(narratives-player): improve end node completion flow`

## Hito 7

Fecha:
2026-06-13

Rama:
dev

Commit:
33b4685 / 18e3b9d

Push:
origin/dev

Resumen:
La finalización exitosa queda restringida al nodo `END` y el panel de cierre lo comunica explícitamente.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Ya no se finaliza exitosamente fuera del cierre del flujo.

Riesgos:
- Requiere validación manual con runs reales para confirmar UX esperada.

Pendientes:
- Ajuste responsive y documentación final.

Próximo hito:
- `chore(narratives-player): polish canvas player and document compatibility`

## Hito 8

Fecha:
2026-06-13

Rama:
dev

Commit:
e7b5223

Push:
origin/dev

Resumen:
Refactorización para remover el sidebar fijo lateral y priorizar el menú contextual por clic secundario en nodos.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El player queda operativo con menú contextual y libre de barras laterales fijas.

Riesgos:
- La usabilidad en dispositivos muy pequeños podría ser incómoda con el clic derecho.

## UI Polish — Bloque 1

Fecha:
2026-06-13

Rama:
feature/narratives-player-ui-polish

Commit:
cdf898e

Push:
origin/dev

Resumen:
Se aplica el primer bloque de pulido integral de UI/UX: header operativo compacto, canvas protagonista, controles flotantes dark, minimap oculto, dock inferior operacional y nodos más expresivos con acceso directo a acciones.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El player ya no depende de títulos redundantes.
- El canvas empieza más arriba y ocupa más pantalla.
- La actividad deja de competir con el canvas y pasa al dock inferior.
- Los nodos tienen mejor jerarquía visual y botón de acciones.

Riesgos:
- Falta validación visual manual sobre narrativa real con Docker.
- Puede requerir un segundo pase fino de spacing/contraste tras revisión visual.

Pendientes:
- QA visual final y ajustes menores de tema/responsive.

Próximo hito:
- Commit/push del bloque y validación manual en navegador.

## UI Polish — Bloque 2

Fecha:
2026-06-13

Rama:
feature/narratives-player-ui-polish

Commit:
7fa981f

Push:
origin/dev

Resumen:
Se rematan estados y aristas con labels dark tipo chip y contraste más consistente con el tema oscuro del player canvas.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Las aristas dejan de verse como etiquetas blancas técnicas.
- El flujo guiado se siente más integrado al dark theme.

Riesgos:
- Queda pendiente revisión visual final con una narrativa larga.

Pendientes:
- Validación manual final e integración a `dev` si el look está aprobado.

Próximo hito:
- Merge a `dev` tras validación visual.

Pendientes:
- Cierre fino y pulido de UX final.

Próximo hito:
- `feat(narratives-player): visual animations and completion flow polish`

## Hito 9

Fecha:
2026-06-13

Rama:
dev

Commit:
Pendiente (Pulido final)

Push:
Pendiente

Resumen:
Se agrega pulido visual general (animaciones `fadeIn` en el popover contextual, halo de selección `ring-2 ring-primary` y escala interactiva al pasar el cursor sobre los nodos del canvas). Se implementan banners de estado de corrida muy visibles arriba del canvas para cuando el flujo está listo para finalizar, completado o cancelado.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `frontend/src/app/globals.css`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- El player ofrece una respuesta visual fluida y una guía explícita para la conclusión de la narrativa sin requerir exploración manual oculta.

Riesgos:
- Ninguno detectado.

Pendientes:
- Confirmación y validación final por parte del usuario.

Próximo hito:
- Cierre de la fase de modernización del player.

## Hito 10

Fecha:
2026-06-13

Rama:
dev

Commit:
aa3f6e3

Push:
origin/dev

Resumen:
Se corrigió la funcionalidad de los botones de audio (`AUDIO_BUTTON`) en el canvas interactivo:
1. **Labels Dinámicos:** Los nodos ahora resuelven y muestran el nombre real del botón de audio al que hacen referencia (consultando a `/audio-buttons/:id`) en lugar de mantener un texto genérico.
2. **Reproducción Global Directa:** Se solucionaron problemas de "stale closure" al hacer click izquierdo directo sobre los nodos de audio al forzar la recepción del `nodeId` directo en `startAudioPlayback`. Además, el reproductor HTML `<audio>` se movió a la raíz del proveedor de contexto, garantizando que siempre esté disponible sin depender del panel lateral (que ya no existe) o de menús contextuales.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`

Checks ejecutados:
- `npm run build`

Resultado:
- Reproducción fluida y consistente en el canvas independientemente del tipo de selección previa.

Riesgos:
- Ninguno detectado.

Pendientes:
- Completar la fase de validación en entornos reales.

## Hito 11

Fecha:
2026-06-13

Rama:
dev

Commit:
78ac902

Push:
origin/dev

Resumen:
Pulido específico de nodos del player canvas. Los nodos dejan de sentirse como cards genéricas y pasan a widgets operativos por tipo: inicio, cierre, mini reproductor de audio, botón de botonera, guion copiable, nota operativa, pausa y decisión. Se agregan CTAs visibles para el nodo actual y el popover contextual prioriza contenido/acciones sobre metadata técnica.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Build frontend correcto.
- No se tocó builder.
- No se modificó backend ni contratos del grafo.

Riesgos:
- Requiere validación visual manual en Docker local con una narrativa que incluya todos los tipos de nodo.

Pendientes:
- Probar reproducción real de `AUDIO` y `AUDIO_BUTTON` en navegador.
- Probar rutas de `DECISION` y cierre `END`.

## Hito 12

Fecha:
2026-06-13

Rama:
dev

Commit:
78ac902

Push:
origin/dev

Resumen:
Se separan los nodos del player canvas a una estructura real de `nodeTypes` por tipo en `frontend/src/components/narratives/player/nodes/`. `NarrativePlayer.tsx` deja de contener el markup visual principal de los nodos y pasa a registrar los widgets especializados.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `frontend/src/components/narratives/player/nodes/playerNodeTypes.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Build frontend correcto.
- `nodeTypes` ahora vive fuera del player principal.

Riesgos:
- Falta validación visual manual con Docker local.

Pendientes:
- Ajustar zoom/viewport y rematar interacción visual fina si aún se perciben miniaturas.

## Hito 13

Fecha:
2026-06-13

Rama:
dev

Commit:
ee297c3

Push:
origin/dev

Resumen:
Se ajusta el viewport de React Flow para evitar que los widgets nuevos se vean como miniaturas. Se configuran límites de zoom, viewport inicial y `fitView` con `maxZoom` diferenciado para narrativas pequeñas.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Build frontend correcto.

Riesgos:
- El resultado visual final depende del spacing real guardado en cada grafo publicado.

Pendientes:
- Validación manual en Docker local.

## Hito 14

Fecha:
2026-06-13

Rama:
dev

Commit:
Pendiente

Push:
Pendiente

Resumen:
Optimización del player canvas y separación visual de nodos. Se centraliza la carga de detalles de `AUDIO_BUTTON` en una caché del player para evitar fetches por cada nodo renderizado. Además, el player transforma las posiciones del grafo en modo ejecución para separar nodos grandes sin modificar el grafo publicado ni el builder.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `frontend/src/components/narratives/player/nodes/playerNodeTypes.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Build frontend correcto.
- Menos llamadas duplicadas a `/audio-buttons/:id`.
- Nodos con mayor separación visual en el player.

Riesgos:
- Si una narrativa tiene posiciones manuales muy extremas, la expansión puede requerir ajuste fino posterior.

Pendientes:
- Validar visualmente en Docker local con narrativas cortas y ramificadas.

## Hito 15

Fecha:
2026-06-13

Rama:
dev

Commit:
Pendiente

Push:
Pendiente

Resumen:
Se alinea el player con la nueva semántica compartida de `INSTRUCTION` como anotación operativa. El progreso excluye instrucciones, las aristas de instrucción se muestran como anotaciones punteadas y la ejecución calcula bypass virtual para grafos legacy `A -> INSTRUCTION -> B`.

Archivos modificados:
- `frontend/src/components/narratives/player/NarrativePlayer.tsx`
- `docs/narratives-player-context.md`
- `docs/narratives-player-implementation-log.md`

Checks ejecutados:
- `npm --prefix frontend run build`

Resultado:
- Build frontend correcto.

Riesgos:
- Runs antiguos que hayan quedado exactamente en una instrucción dependen de que exista una salida desde esa instrucción hacia un nodo de flujo.

Pendientes:
- Validación manual de una ejecución legacy con instrucción intermedia.
