# Politica de Alineacion de Ramas

## Fuente de verdad

La rama operativa de referencia es `easypanel`.

Toda correccion urgente que afecte:

- despliegue
- configuracion del VPS
- `/board`
- `/narratives`
- autenticacion
- integraciones

debe terminar primero en `easypanel`.

## Ramas que deben mantenerse alineadas

- `easypanel`
- `principal`
- `dev`
- `feature/narratives-player-canvas`
- `feature/narratives-player-ui-polish`
- `feature/narratives-builder-upgrade`

Regla:

- si una rama no tiene trabajo propio por encima de `easypanel`, se alinea con `merge --ff-only`
- si una rama tiene trabajo propio, se integra `easypanel` mediante `merge --no-ff`
- si el contenido final debe quedar identico a `easypanel`, los conflictos se resuelven a favor de `easypanel`

## Flujo operativo obligatorio

1. Trabajar y validar el cambio en `easypanel`.
2. Ejecutar checks minimos:
   - `npm --prefix frontend run build`
   - `npm --prefix backend run build`
3. Hacer `commit` y `push` de `easypanel`.
4. Alinear `principal` y `dev`.
5. Alinear ramas feature activas.
6. Verificar divergencia en Git antes de cerrar el trabajo.

## Comandos de sincronizacion

Actualizar ramas que son ancestro directo de `easypanel`:

```bash
git checkout dev
git merge --ff-only easypanel
git push origin dev

git checkout principal
git merge --ff-only easypanel
git push origin principal
```

Actualizar una rama feature con trabajo propio:

```bash
git checkout feature/nombre-rama
git merge --no-ff easypanel
git push origin feature/nombre-rama
```

Verificar divergencia contra `easypanel`:

```bash
git rev-list --left-right --count rama...easypanel
git diff --stat easypanel..rama
```

Interpretacion:

- `0 N` significa que la rama esta atrasada respecto a `easypanel`
- `N 0` significa que la rama tiene trabajo encima de `easypanel`
- `0 0` significa que la rama ya esta alineada

## Criterio para resolver conflictos

Usar la version de `easypanel` cuando el archivo conflictivo pertenezca a una zona que ya fue reescrita o estabilizada ahi, por ejemplo:

- `frontend/src/components/audio-board/*`
- `frontend/src/components/narratives/player/*`
- archivos de deploy
- documentacion operativa

Comando util:

```bash
git checkout --theirs ruta/al/archivo
git add ruta/al/archivo
```

En un merge hecho desde una rama secundaria hacia `easypanel`, `theirs` equivale a la version entrante de `easypanel`.

## Checklist antes de cerrar una sesion

- `git status` limpio
- `origin/easypanel` actualizado
- `principal` alineada
- `dev` alineada
- features activas alineadas o documentadas como divergentes
- checks minimos ejecutados

## Nota de disciplina

No dejar hotfixes solo en ramas secundarias.

Si un arreglo se prueba en produccion o en Easypanel, debe quedar integrado primero en `easypanel` y luego propagado al resto.
