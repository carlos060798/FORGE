# Accessibility Baseline — FORGE Craft

Adoptado de open-design (nexu-io). Referencia para agentes de diseño.

---

## Principio fundamental

**Accesibilidad no es una feature extra — es la calidad mínima.**

Un wireframe inaccesible no es un MVP funcional. Estas reglas se aplican a todos los artefactos HTML generados por FORGE, sin excepción.

---

## Checklist de accesibilidad mínima (WCAG AA)

### Estructura semántica

- [ ] `<html lang="es">` — idioma declarado
- [ ] Un solo `<h1>` por página — el título principal
- [ ] Jerarquía de headings sin saltos: h1 → h2 → h3 (no saltar de h1 a h3)
- [ ] `<main>`, `<header>`, `<nav>`, `<footer>` — landmarks semánticos
- [ ] `<button>` para acciones, `<a>` para navegación — nunca `<div onclick>`
- [ ] Formularios con `<label>` asociado a cada `<input>` (via `for` + `id`)

### Contraste de color

- [ ] Texto normal (< 18px no bold): ratio ≥ 4.5:1
- [ ] Texto grande (≥ 18px o ≥ 14px bold): ratio ≥ 3:1
- [ ] Iconos y bordes de UI: ratio ≥ 3:1
- [ ] Texto desactivado (disabled): puede tener ratio menor — es intencional

### Teclado

- [ ] Todos los elementos interactivos son alcanzables con Tab
- [ ] El foco visible es obvio (no eliminar `outline: none` sin reemplazarlo)
- [ ] Los dropdowns y modales son navegables con teclado (Enter/Escape/Flechas)
- [ ] El orden de Tab sigue el flujo visual de izquierda a derecha, arriba a abajo

### Imágenes y medios

- [ ] `<img alt="descripción">` — siempre, aunque sea vacío (`alt=""`) para imágenes decorativas
- [ ] Iconos SVG con `aria-hidden="true"` si son decorativos, o `aria-label` si comunican algo
- [ ] No usar solo color para comunicar estado (agregar texto o icono también)

### Formularios

- [ ] Mensajes de error junto al campo (no solo cambio de color del borde)
- [ ] `required` en campos obligatorios + indicación visual (asterisco + leyenda)
- [ ] `autocomplete` en campos comunes: `name`, `email`, `tel`, `current-password`

---

## HTML semántico en wireframes FORGE

### Estructura base de cada wireframe

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Nombre del producto] — [Nombre de pantalla]</title>
</head>
<body>
  <header>
    <nav aria-label="Navegación principal">...</nav>
  </header>
  <main>
    <h1>[Título principal de la pantalla]</h1>
    <!-- contenido -->
  </main>
</body>
</html>
```

### Botones correctos vs incorrectos

```html
<!-- ✅ Correcto -->
<button type="button" class="btn-primary">Crear cita</button>
<button type="submit" class="btn-primary">Guardar cambios</button>

<!-- ❌ Incorrecto — div no es interactivo por defecto -->
<div class="btn-primary" onclick="...">Crear cita</div>
```

### Labels de formularios

```html
<!-- ✅ Correcto — label asociado por for/id -->
<label for="paciente-nombre">Nombre del paciente</label>
<input id="paciente-nombre" type="text" autocomplete="name" required>

<!-- ✅ Correcto — label envolvente -->
<label>
  Nombre del paciente
  <input type="text" autocomplete="name" required>
</label>

<!-- ❌ Incorrecto — placeholder no reemplaza el label -->
<input type="text" placeholder="Nombre del paciente">
```

### Foco visible

```css
/* ✅ Foco visible con el color de acento */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ❌ Nunca eliminar el foco sin reemplazarlo */
* { outline: none; }
```

### Iconos SVG

```html
<!-- ✅ Icono decorativo (acompañado de texto) -->
<button>
  <svg aria-hidden="true" focusable="false">...</svg>
  Crear cita
</button>

<!-- ✅ Icono solo (sin texto) -->
<button aria-label="Cerrar menú">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>

<!-- ❌ Icono sin descripción -->
<button>
  <svg>...</svg>
</button>
```

---

## Estado de elementos interactivos

Cada elemento interactivo debe tener estilos para 4 estados:

| Estado | CSS | Cuándo |
|--------|-----|--------|
| Normal | (base) | Sin interacción |
| Hover | `:hover` | Ratón encima (desktop) |
| Focus | `:focus-visible` | Navegación por teclado |
| Disabled | `[disabled]`, `aria-disabled="true"` | No disponible |
| Active | `:active` | Click/tap en progreso |

```css
.btn-primary { background: var(--accent); color: var(--text-inverse); }
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary:active { transform: translateY(1px); }
```

---

## ARIA mínimo necesario

No sobrecargar con ARIA. La regla: **si el HTML semántico ya lo comunica, no añadir ARIA**.

```html
<!-- Necesario: nav con múltiples navs en la página -->
<nav aria-label="Navegación principal">...</nav>
<nav aria-label="Breadcrumb">...</nav>

<!-- Necesario: estado de un componente dinámico -->
<button aria-expanded="false" aria-controls="menu-id">Menú</button>
<div id="menu-id" hidden>...</div>

<!-- Necesario: live regions para notificaciones -->
<div role="status" aria-live="polite" id="notifications"></div>

<!-- No necesario: botón ya tiene rol button -->
<button role="button">No necesario</button>
```

---

## Responsive mínimo

```css
/* Viewport meta — siempre */
<meta name="viewport" content="width=device-width, initial-scale=1.0">

/* Tamaño de tap target mínimo — 44x44px */
button, a, input[type="checkbox"], input[type="radio"] {
  min-height: 44px;
  min-width: 44px;
}

/* Texto legible en mobile */
body { font-size: 16px; } /* evita zoom automático en iOS */
input, textarea, select { font-size: 16px; } /* evita zoom en focus en iOS */
```

---

## Referencia rápida para agentes

Antes de cerrar el `<artifact>`, verificar:

1. `<html lang="es">` presente
2. Un solo `<h1>` en la página
3. Todos los `<input>` tienen `<label>` asociado
4. Todos los `<button>` tienen texto o `aria-label`
5. Imágenes tienen `alt`
6. `:focus-visible` definido con `outline` visible
7. No usar `<div>` para elementos clicables — usar `<button>` o `<a>`
8. Contraste de texto verificado mentalmente (colores del DESIGN.md tienen ratio ≥ 4.5:1)
