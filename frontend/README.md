# Routlis Frontend

Interfaz web de Routlis V1 AudioBoard construida con Next.js.

## Características

- Login con cookie httpOnly.
- Botonera operativa en `/board`.
- Selector de vista con modo simple y modo de 2 columnas.
- En modo dual, cada lado tiene búsqueda y filtros independientes.
- Scroll interno para listas largas de tarjetas sin afectar el player.
- Vista administrativa en `/admin`.
- Vista global de organizaciones en `/admin/organizations` para `OWNER`.
- Búsqueda y filtros por categoría, recientes y favoritos.
- Reproducción de audios protegidos con sesión.
- Botones compactos con imagen, etiqueta y acciones rápidas.
- Popup de detalles con imagen, texto y descargas.
- Modal de configuración de cuenta.
- El dashboard de `/admin` oculta la métrica de almacenamiento para usuarios que no son `OWNER`.

## Requisitos

- Node.js y npm.
- Backend de Routlis corriendo en `http://localhost:4000`.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

## Build

```bash
npm run build
```

## Notas

- La navegación y permisos dependen del usuario autenticado.
- La opción de almacenamiento solo se muestra a usuarios `OWNER`, y la pantalla `/admin/storage` también queda restringida a ese rol.
- `OWNER` también puede cambiar la organización activa desde la pantalla de organizaciones.
- El resto de roles permanece aislado a su organización activa.
- El layout usa rutas protegidas y redirección automática a `/login`.
