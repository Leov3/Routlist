# Checklist de despliegue en 10 minutos

> Checklist historico. La ruta activa de Routlis v1.1 usa la rama `principal`, Docker Compose y un proxy externo con Nginx Proxy Manager.

## Objetivo

Dejar Routlis listo para:

- GitHub Actions
- VPS con Docker Compose directo
- arranque local sin fricción

## 1. GitHub

- [ ] Crear los secretos `VPS_HOST`, `VPS_USER`, `VPS_APP_DIR`, `VPS_SSH_PRIVATE_KEY`, `VPS_COMPOSE_PROFILE`.
- [ ] Verificar que `VPS_APP_DIR` apunte al clon real del repo en el VPS.
- [ ] Confirmar que la rama protegida o automatizada es `principal`.

## 2. VPS

- [ ] Crear `/opt/routlis`.
- [ ] Clonar o copiar el repositorio en `/opt/routlis/app`.
- [ ] Crear `/opt/routlis/.env` a partir de [`deploy/vps.env.example`](/home/leonardo/Documentos/Proyectos/ROUTLIS/deploy/vps.env.example).
- [ ] Completar `POSTGRES_PASSWORD`.
- [ ] Completar `JWT_SECRET`.
- [ ] Confirmar `FRONTEND_URL` y `CORS_ORIGINS`.
- [ ] Confirmar `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_MEDIA_URL`.
- [ ] Confirmar `SEED_ADMIN_PASSWORD`.

## 3. Local

- [ ] Crear `.env` local en la raiz del proyecto si lo necesitas para pruebas manuales.
- [ ] Levantar el stack con `docker compose up -d --build`.
- [ ] Verificar backend en `http://localhost:4000/health`.
- [ ] Verificar frontend en `http://localhost:3001`.

## 4. Produccion

### Si usas la ruta activa

- [ ] Definir `LETSENCRYPT_EMAIL`.
- [ ] Definir `FRONTEND_HOST`.
- [ ] Definir `API_HOST`.
- [ ] Usar `bash scripts/deploy-vps.sh deploy`.

## 5. Bootstrap inicial

- [ ] Ejecutar el despliegue.
- [ ] Aplicar migraciones.
- [ ] Ejecutar seed solo si es un bootstrap o reseed manual.
- [ ] Confirmar login con `admin@routlis.local`.

## 6. Verificacion final

- [ ] `GET /health` responde `200`.
- [ ] `POST /auth/login` responde `200`.
- [ ] `/board` abre y reproduce audios.
- [ ] `/admin/storage` funciona.
- [ ] El deploy por GitHub actualiza el VPS sin pasos manuales extra.

## 7. Referencias

- [`documentos/variables_github_easypanel_routlis_v1.md`](/home/leonardo/Documentos/Proyectos/ROUTLIS/documentos/variables_github_easypanel_routlis_v1.md)
- [`documentos/plan_deploy_vps_traefik_autodeploy_routlis_v1.md`](/home/leonardo/Documentos/Proyectos/ROUTLIS/documentos/plan_deploy_vps_traefik_autodeploy_routlis_v1.md)
- [`README.md`](/home/leonardo/Documentos/Proyectos/ROUTLIS/README.md)
