# Narrativas MVP - Etapa 1

Estado: implementada en backend y validada localmente.

Incluye:
- modelos Prisma para Narrative, NarrativeVersion, NarrativeRun y NarrativeRunEvent;
- permisos RBAC de narrativas;
- módulo backend para CRUD, validación de grafo, publicación y ejecución;
- migración SQL para el esquema nuevo;
- seed actualizado para limpiar datos de narrativas solo cuando se usa reset controlado.

Pendiente para siguientes etapas:
- builder visual en frontend;
- player guiado en frontend;
- integración de permisos UI;
- exportación / reportes narrativos.

Nota de continuidad:
- trabajar siempre en `dev` hasta estabilizar;
- no tocar persistencia existente de audios, botones, usuarios ni storage;
- usar esta nota como contexto rápido para continuar la etapa 2.
