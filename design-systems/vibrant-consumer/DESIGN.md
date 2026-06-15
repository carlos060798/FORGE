# Vibrant Consumer — DESIGN.md

**Tagline**: Energía en cada píxel. Para productos que quieren ser amados.

Un sistema de diseño de alta energía para productos B2C que compiten por atención. Color saturado, tipografía expresiva, interacciones que se sienten vivas.

---

## 1. Visual Theme & Atmosphere

Vibrant Consumer lleva el color al máximo sin cruzar la línea hacia lo ruidoso. Inspirado en apps como Duolingo, Notion, Linear y los mejores productos de consumo actuales. El color no es decoración — es el lenguaje.

**Sensación**: energía, accesibilidad, diversión, momentum.
**Anti-sensación**: aburrimiento, austeridad, frialdad.

Productos ideales: apps de fitness, educación, marketplace B2C, redes sociales, fintech para consumidores, apps de entretenimiento, onboarding de herramientas.

---

## 2. Color Palette & Roles

```css
:root {
  /* Fondos */
  --bg-base:       #F8F7FF;       /* blanco con tinte violeta muy sutil */
  --bg-surface:    #FFFFFF;
  --bg-surface2:   #F0EEFF;

  /* Texto */
  --text-primary:  #1A1535;       /* casi negro con tinte violeta */
  --text-secondary:#3D3660;
  --text-muted:    #7B74A8;
  --text-inverse:  #FFFFFF;

  /* Acento principal — violeta vibrante */
  --accent:        #6C3FF5;
  --accent-hover:  #5A32D0;
  --accent-subtle: #EDE8FF;

  /* Acento secundario — coral/naranja para CTAs secundarios */
  --accent2:       #FF6B35;
  --accent2-hover: #E55A24;
  --accent2-subtle:#FFF0EB;

  /* Bordes */
  --border:        #E2DCFF;
  --border-strong: #6C3FF5;

  /* Semánticos */
  --error:         #E53E3E;
  --success:       #38A169;
  --warning:       #DD6B20;
}
```

**Regla de color**: dos acentos (primario + secundario) usados con intención. El primario para acciones principales y navegación, el secundario para urgencia/promoción. Nunca mezclarlos en el mismo componente.

---

## 3. Typography Rules

**Display**: **Nunito** (Google Fonts) — `font-weight: 800, 900` — redondeada, amigable
**Body**: Nunito — `font-weight: 400, 600`
**UI alternativa**: **Plus Jakarta Sans** — más neutra para dashboards

```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800;900&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: 'Nunito', system-ui, sans-serif;
  --font-body:    'Nunito', system-ui, sans-serif;
  --font-mono:    'Fira Code', monospace;
}
```

**Escala**:
- Hero h1: 48–64px, weight 900, letter-spacing -0.02em
- Section h2: 28px, weight 800
- Body: 15px, line-height 1.65
- Labels: 13px, weight 600

---

## 4. Component Stylings

### Botones
```css
.btn-primary {
  background: var(--accent);
  color: var(--text-inverse);
  padding: 14px 28px;
  border-radius: 12px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(108, 63, 245, 0.35);
  transition: all 0.15s;
}
.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(108, 63, 245, 0.45);
}

.btn-secondary {
  background: var(--accent-subtle);
  color: var(--accent);
  border: none;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 700;
}

.btn-cta {        /* para CTAs de conversión urgente */
  background: var(--accent2);
  color: var(--text-inverse);
  border-radius: 12px;
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(255, 107, 53, 0.35);
}
```

### Cards
```css
.card {
  background: var(--bg-surface);
  border: 1.5px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(108, 63, 245, 0.06);
}
.card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 4px 16px rgba(108, 63, 245, 0.12);
}
```

### Inputs
```css
input, textarea, select {
  background: var(--bg-surface);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
  font-family: var(--font-body);
  font-size: 15px;
  transition: border-color 0.15s;
}
input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
  outline: none;
}
```

### Badges / Pills
```css
.badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  background: var(--accent-subtle);
  color: var(--accent);
}
.badge-success { background: #E6FFEE; color: #38A169; }
.badge-warning { background: #FFFBE6; color: #DD6B20; }
```

### Progress bars
```css
.progress { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.5s; }
```

---

## 5. Layout Principles

- **Máximo ancho**: 1200px con padding lateral de 24px en mobile, 48px en desktop
- **Grid**: 12 columnas, gutter 24px
- **Spacing**: escala de 4px: 4, 8, 12, 16, 24, 32, 48, 64, 96
- **Cards en grid**: 2–3 columnas en desktop, 1 en mobile
- **Secciones con fondo alternado**: usar `--bg-surface2` (violeta muy claro) para secciones importantes

---

## 6. Depth & Elevation

```css
/* Nivel 1 — base elevation */
.shadow-sm { box-shadow: 0 1px 4px rgba(108,63,245,0.06); }

/* Nivel 2 — cards interactivas */
.shadow-md { box-shadow: 0 4px 16px rgba(108,63,245,0.10); }

/* Nivel 3 — modales, dropdowns */
.shadow-lg { box-shadow: 0 8px 32px rgba(108,63,245,0.16); }

/* Botones CTA — sombra de color */
.shadow-accent { box-shadow: 0 4px 14px rgba(108,63,245,0.35); }
```

---

## 7. Do's and Don'ts

**Do**:
- Usa el color de acento en las acciones principales — que sea obvio qué hacer
- Gradientes sutiles en elementos de display (de `--accent` a `--accent-hover` horizontal — nunca diagonal)
- Micro-animaciones en hover de botones (`transform: translateY(-1px)`)
- Emojis solo en onboarding o estados vacíos (no como iconos de feature)
- `border-radius: 12–16px` en cards y botones — redondeado pero no excesivo

**Don't**:
- Gradiente en diagonal sobre el hero (regla P0 de anti-ai-slop)
- Usar los dos acentos juntos en el mismo componente
- Texto blanco sobre color claro (verificar contraste siempre)
- Más de 3 colores diferentes en la misma pantalla
- Sombras de color negro — en este sistema las sombras son del color del acento

---

## 8. Responsive Behavior

```css
body { font-size: 15px; background: var(--bg-base); }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

@media (min-width: 768px) {
  .container { padding: 0 48px; }
  .grid-cards { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .grid-cards { grid-template-columns: repeat(3, 1fr); }
}
```

---

## 9. Agent Prompt Guide

Cuando generes wireframes con Vibrant Consumer:

- **El color es protagonista**: el acento violeta `#6C3FF5` en botones, links, indicadores activos — que sea visible desde lejos
- **Botones con sombra de color**: `box-shadow: 0 4px 14px rgba(108,63,245,0.35)` en el botón primario
- **Emojis permitidos** (solo en): estados vacíos, ilustraciones de onboarding, celebraciones de logro
- **Cards con border-radius 16px**: redondeadas pero no burbujas
- **Sin iconos de emoji para features** — los features usan SVG o texto, no 🚀📊✨
- **CTA secundario con color 2** (`--accent2`): coral/naranja para urgencia (ofertas, límites de tiempo)
- **Progress y gamificación**: este sistema es el adecuado para streaks, puntos, barras de progreso
- **Hover animado**: los botones suben 1px al hacer hover — `transform: translateY(-1px)`
- **Gradiente permitido** (solo): de `--accent` a `--accent-hover` en dirección horizontal, solo en elementos de display grande, nunca en el hero completo
