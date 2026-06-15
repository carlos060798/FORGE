# Editorial Minimal — DESIGN.md

**Tagline**: Silencio tipográfico. El diseño que se quita de en medio.

Un sistema austero donde solo existe lo necesario. Más espacio en blanco que contenido visible. Cada elemento justifica su presencia.

---

## 1. Visual Theme & Atmosphere

Editorial Minimal es la reducción máxima. Sin color de acento visible en el estado de reposo. La tipografía es el único ornamento. Inspirado en la arquitectura japonesa (ma — el valor del espacio vacío) y en las mejores publicaciones tipográficas europeas.

**Sensación**: quietud, autoridad, precisión.
**Anti-sensación**: caos, ruido, urgencia.

Productos ideales: firmas de abogados, consultoras de alto nivel, estudios de fotografía, galerías, portfolios de diseño, plataformas editoriales premium.

---

## 2. Color Palette & Roles

```css
:root {
  /* Fondos */
  --bg-base:       #FFFFFF;
  --bg-surface:    #FAFAFA;
  --bg-surface2:   #F5F5F5;

  /* Texto */
  --text-primary:  #0A0A0A;
  --text-secondary:#2A2A2A;
  --text-muted:    #767676;
  --text-inverse:  #FFFFFF;

  /* Acento — solo aparece en acciones, no en decoración */
  --accent:        #0A0A0A;
  --accent-hover:  #2A2A2A;
  --accent-subtle: #F0F0F0;

  /* Bordes */
  --border:        #E0E0E0;
  --border-strong: #0A0A0A;

  /* Semánticos */
  --error:         #CC0000;
  --success:       #006600;
  --warning:       #AA6600;
}
```

**Regla de color**: casi monocromático. El "acento" es negro sobre blanco. El único color permitido es uno de semántica (error/success), y solo cuando hay un mensaje que mostrar.

---

## 3. Typography Rules

**Display**: Freight Display Pro (si disponible) o **Cormorant Garamond** (Google Fonts) — `font-weight: 300, 600`
**Body**: **IBM Plex Serif** o **Lora** (Google Fonts) — `font-weight: 400`
**UI labels**: **IBM Plex Sans** — `font-weight: 400, 500`
**Code**: IBM Plex Mono

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;600&family=Lora:wght@400&family=IBM+Plex+Sans:wght@400;500&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body:    'Lora', Georgia, serif;
  --font-ui:      'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;
}
```

**Escala**:
- Hero h1: `clamp(48px, 8vw, 96px)`, weight 300, letter-spacing -0.02em
- Section h2: 32px, weight 600
- Body: 17px, line-height 1.75
- UI labels: 13px, weight 500, letter-spacing 0.04em, UPPERCASE

---

## 4. Component Stylings

### Botones
```css
.btn-primary {
  background: var(--accent);
  color: var(--text-inverse);
  padding: 12px 32px;
  border: 1px solid var(--accent);
  border-radius: 0;                  /* sin border-radius */
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-strong);
  /* mismas propiedades de tipografía */
}
```

### Cards
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 40px;
}
```

### Inputs
```css
input, textarea {
  border: none;
  border-bottom: 1px solid var(--border-strong);
  border-radius: 0;
  padding: 12px 0;
  background: transparent;
  font-family: var(--font-ui);
  font-size: 15px;
}
input:focus { border-bottom-color: var(--accent); outline: none; }
```

### Divisores
```css
hr { border: none; border-top: 1px solid var(--border); margin: 64px 0; }
```

---

## 5. Layout Principles

- **Máximo ancho de contenido**: 720px (texto), 1100px (layout completo)
- **Grid**: 12 columnas con gutter de 32px
- **Espaciado**: múltiplos de 8px (8, 16, 24, 32, 48, 64, 96, 128)
- **Margen vertical entre secciones**: mínimo 96px — el espacio es parte del diseño
- El espacio vacío no es "espacio perdido" — es el diseño

---

## 6. Depth & Elevation

Sin sombras. La elevación se comunica con bordes y diferencia de color de fondo.

```css
/* Sin box-shadow — usar separación cromática */
.elevated { background: var(--bg-surface); border: 1px solid var(--border); }
```

---

## 7. Do's and Don'ts

**Do**:
- Usa el espacio vacío como elemento de diseño activo
- Un elemento centrado, mucho espacio alrededor — máxima elegancia
- Tipografía de display condensada y ligera para títulos grandes
- Líneas horizontales finas como únicos separadores decorativos
- Texto en mayúsculas solo para labels de 1–3 palabras

**Don't**:
- Colores de fondo en secciones (no alternar gris/blanco en secciones)
- Sombras de ningún tipo
- Más de 2 familias tipográficas
- Botones con border-radius redondeado
- Emojis o iconos decorativos de ningún tipo

---

## 8. Responsive Behavior

```css
/* Mobile first */
body { font-size: 16px; padding: 24px; }
h1 { font-size: clamp(32px, 7vw, 96px); }
.container { max-width: 720px; margin: 0 auto; padding: 0 24px; }

@media (min-width: 768px) {
  body { padding: 40px; }
  .container { padding: 0 40px; }
}
```

---

## 9. Agent Prompt Guide

Cuando generes wireframes con Editorial Minimal:

- **Espacio blanco**: la pantalla debe tener más espacio vacío que contenido — si parece "llena", elimina elementos
- **Tipografía como jerarquía**: el título principal debe ser grande (≥ 48px), ligero (weight 300), y tener mucho espacio alrededor
- **Sin color de acento visible**: el negro es el acento. No añadir color decorativo
- **Inputs underline**: los campos de formulario solo tienen borde inferior, sin caja
- **Botones con borde cuadrado**: `border-radius: 0`, tipografía en mayúsculas pequeñas
- **Sin sombras**: la elevación es con borde y fondo diferenciado
- **Centrar con propósito**: elementos importantes centrados en página, no en columna lateral
- **La regla de oro**: si puedes eliminar un elemento y la pantalla mejora, elimínalo
