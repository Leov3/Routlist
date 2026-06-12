# Checklist de estado estable v1.1

Este checklist resume el flujo que ya quedó validado para Routlis v1.1:

- desarrollo local con Docker Compose
- GitHub en la rama `principal`
- VPS con despliegue no destructivo
- PostgreSQL y storage persistentes
- proxy externo fuera del compose de la app

## 1. Antes de cambiar nada

- Verifica que estás en la rama `principal`.
- Confirma que el repo local y GitHub están sincronizados.
- Confirma que el VPS usa el mismo código que GitHub.
- No borres volúmenes ni storage manualmente.

## 2. Datos que deben sobrevivir siempre

Estos datos no deben perderse por commits, pull, build o redeploy normal:

- usuarios
- roles
- organizaciones
- membresías
- preferencias de usuario
- categorías
- audios subidos
- botones creados por usuarios
- imágenes de botones
- favoritos
- historial de reproducción
- configuraciones operativas del panel

## 3. Flujo local

- Levanta el stack con `docker compose up -d --build`.
- Aplica migraciones con `docker compose exec backend npm run prisma:deploy`.
- Usa seed solo para desarrollo o bootstrap manual.
- No uses `docker compose down -v` salvo que quieras borrar todo a propósito.

## 4. Flujo GitHub

- La rama activa es `principal`.
- Cada cambio funcional debe pasar por build local antes de subir.
- El repositorio remoto debe reflejar el mismo estado que el local antes del deploy.
- La documentación debe describir lo que la app realmente hace hoy, no flujos históricos.

## 5. Flujo VPS

- El VPS usa Docker Compose.
- La base de datos va en volumen persistente.
- El storage de audios e imágenes va en volumen persistente.
- El proxy externo expone el frontend y la API.
- El deploy normal debe:
  - reconstruir imágenes
  - reiniciar contenedores
  - aplicar migraciones evolutivas
  - conservar volúmenes

## 6. Criterios de salud

La plataforma está alineada solo si:

- `frontend` compila
- `backend` compila
- `/health` responde `200`
- `/public/stats` responde sin romper el login
- `/auth/login` inicia sesión
- `/admin/buttons` muestra los botones persistidos
- `/admin/audios` muestra los audios persistidos
- `/board` carga la botonera con datos reales
- el redeploy no borra usuarios ni contenido subido

## 7. Señales de alarma

Detén el deploy y revisa si aparece cualquiera de estas situaciones:

- `down -v`
- recreación del volumen de PostgreSQL
- recreación del volumen de storage
- seed automático en producción
- `CORS` o `COOKIE_SECURE` desalineados con el dominio real
- una pantalla admin vacía pero con DB poblada

## 8. Verificación rápida

```bash
npm -C backend run build
npm -C frontend run build
```

```bash
bash scripts/deploy-vps.sh preflight
bash scripts/deploy-vps.sh deploy
bash scripts/deploy-vps.sh verify
```

## 9. Resultado esperado

Si todo está bien:

- el código cambia
- los datos quedan intactos
- los botones existentes siguen visibles
- los audios siguen accesibles
- las imágenes siguen asociadas a sus botones

