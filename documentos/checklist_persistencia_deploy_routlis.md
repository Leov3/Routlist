# Checklist de persistencia para deploys de Routlis

Este checklist valida que un despliegue nuevo no borre:

- usuarios
- organizaciones
- preferencias
- botones
- audios
- imagenes asociadas a botones

## Antes del deploy

1. Verifica que existan los volumenes persistentes:

```bash
bash scripts/deploy-vps.sh preflight
```

2. Crea un respaldo antes de tocar nada:

```bash
bash scripts/deploy-vps.sh backup
```

3. Confirma que el VPS esta usando el `docker-compose.prod.yml` correcto.

4. Confirma que no se va a ejecutar ninguna limpieza destructiva:

```bash
docker compose down -v
```

Ese comando no debe usarse en produccion.

## Durante el deploy

1. Ejecuta el despliegue normal:

```bash
bash scripts/deploy-vps.sh deploy
```

2. Aplica solo migraciones nuevas:

```bash
docker compose -f docker-compose.prod.yml -p routlis exec -T backend npm run prisma:deploy
```

3. No recrees volumenes, no borres `/var/lib/docker/volumes`, no borres `/var/www/routlis/storage`.

## Despues del deploy

1. Comprueba que los contenedores siguen arriba:

```bash
docker ps
```

2. Comprueba que la base responde:

```bash
curl -fsS https://api.31.97.65.9.nip.io/health
```

3. Comprueba que el storage sigue accesible:

```bash
curl -I https://api.31.97.65.9.nip.io/files/audio-assets
```

4. Ejecuta la verificacion automatica:

```bash
bash scripts/deploy-vps.sh verify
```

5. Haz una prueba funcional con un audio y un boton con imagen ya creados.

## Si algo falla

1. Restaura el ultimo backup disponible:

```bash
bash scripts/deploy-vps.sh rollback
```

## Criterio de aceptacion

El deploy es correcto solo si:

- el volumen de PostgreSQL sigue existiendo
- el volumen de storage sigue existiendo
- los usuarios siguen autenticando
- los audios siguen reproduciendose
- las imagenes de botones siguen visibles
