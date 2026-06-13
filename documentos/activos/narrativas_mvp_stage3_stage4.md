# Narrativas MVP - Etapas 3 y 4

Estado actual:
- El backend ya valida y publica el grafo de Narrativas.
- La ejecución narrativa ya usa:
  - `POST /narratives/:id/runs`
  - `GET /narrative-runs/:id`
  - `PATCH /narrative-runs/:id/current-node`
  - `POST /narrative-runs/:id/events`
  - `POST /narrative-runs/:id/complete`
  - `POST /narrative-runs/:id/cancel`
- Se añadió un stream específico para Narrativas en audios:
  - `GET /audio-assets/:id/narrative-stream`
- El frontend ya tiene:
  - listado de narrativas activas en `/narratives`
  - player guiado en `/narratives/[id]/run`
- El build de frontend y backend pasa correctamente.

Pendiente después:
- Pulido de UX del player.
- Mejorar automatizaciones de avance por tipo de nodo si hace falta.
- Añadir reportes básicos de ejecución de narrativas.
