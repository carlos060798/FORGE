# DESIGN SYSTEM: Bold Brutalist

> **Dirección**: Impactante, directo, sin adornos. Colores saturados, tipografía masiva, estructura visible. Honesto sobre lo que es.

---

## 1. Visual Theme & Atmosphere

El diseño no esconde nada. Estructura visible, bordes duros, peso tipográfico máximo.
No busca gustar — busca impactar. Funcional y agresivamente visual.

**Palabras clave**: impactante · directo · audaz · sin excusas · estructural · honesto

---

## 2. Color Palette & Roles

```css
/* Fondos */
--bg-base:       #0A0A0A;   /* casi negro */
--bg-surface:    #141414;   /* negro algo más claro */
--bg-subtle:     #1F1F1F;   /* superficies elevadas */
--bg-emphasis:   #2A2A2A;   /* hover */

/* Texto */
--text-primary:  #F5F5F5;   /* casi blanco */
--text-secondary:#A0A0A0;   /* gris medio */
--text-muted:    #5A5A5A;   /* deshabilitados */
--text-inverse:  #0A0A0A;   /* sobre fondos claros */

/* Acento — uno solo, saturado */
--accent:        #F0E040;   /* amarillo brillante — el único color */
--accent-hover:  #D4C400;
--accent-subtle: #2A2800;   /* fondo de chips con acento */

/* Estado */
--success:       #39FF14;   /* verde neón */
--warning:       #FF6B00;   /* naranja */
--error:         #FF2D2D;   /* rojo */
--info:          #00BFFF;   /* azul cielo */

/* Bordes — el alma del brutalismo */
--border:        #333333;
--border-strong: #F5F5F5;   /* borde blanco para énfasis */
--border-accent: #F0E040;   /* borde amarillo para acción */
```

---

## 3. Typography Rules

```css
/* Fuentes — pesadas, directas */
--font-display: 'Space Grotesk', 'Arial Black', sans-serif;
--font-body:    'Space Grotesk', 'Arial', sans-serif;
--font-mono:    'Space Mono', 'Courier New', monospace;

/* Escala — extremos */
--text-xs:   11px / 1.3;
--text-sm:   13px / 1.4;
--text-base: 16px / 1.5;
--text-lg:   20px / 1.4;
--text-xl:   28px / 1.2;
--text-2xl:  40px / 1.1;
--text-3xl:  56px / 1.0;
--text-4xl:  80px / 0.95;   /* headings héroe masivos */

/* Pesos */
--weight-bold:     700;
--weight-black:    900;   /* para headings principales */
```

**Reglas específicas**:
- H1: Space Grotesk, 56–80px, weight 900, uppercase, tracking -0.02em
- H2: Space Grotesk, 40px, weight 700, uppercase
- Body: Space Grotesk, 16px, weight 400, line-height 1.6
- Labels/UI: Space Mono, 12px, uppercase, letter-spacing 0.1em
- Nunca itálica (el brutalismo es recto)

---

## 4. Component Stylings

### Botones — el elemento más característico
```css
/* Primario — el brutalismo signature */
.btn-primary {
  background: var(--accent);
  color: var(--text-inverse);
  padding: 14px 32px;
  border-radius: 0;              /* cuadrado perfecto */
  border: 2px solid var(--accent);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  /* El shadow offset es el sello del brutalismo */
  box-shadow: 4px 4px 0 var(--border-strong);
  transition: box-shadow 0.1s, transform 0.1s;
}
.btn-primary:hover {
  box-shadow: 2px 2px 0 var(--border-strong);
  transform: translate(2px, 2px);
}
.btn-primary:active {
  box-shadow: 0 0 0 var(--border-strong);
  transform: translate(4px, 4px);
}

/* Outline */
.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 2px solid var(--border-strong);
  padding: 14px 32px;
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 var(--border-strong);
}
```

### Cards
```css
.card {
  background: var(--bg-surface);
  border: 2px solid var(--border-strong);
  border-radius: 0;
  padding: 24px 28px;
  box-shadow: 6px 6px 0 var(--border-accent);  /* shadow offset amarillo */
}

.card:hover {
  box-shadow: 3px 3px 0 var(--border-accent);
  transform: translate(3px, 3px);
  transition: all 0.1s;
}
```

### Inputs
```css
.input {
  background: var(--bg-subtle);
  border: 2px solid var(--border-strong);
  border-radius: 0;
  padding: 12px 16px;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-primary);
}
.input:focus {
  border-color: var(--accent);
  outline: none;
}
```

### Tags / Badges
```css
.badge {
  display: inline-flex;
  padding: 3px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.badge-accent {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-subtle);
}
```

---

## 5. Layout Principles

- **Grid**: 12 columnas, gutter 20px, max-width 1280px (más amplio que lo usual)
- **Bordes como estructura**: los contenedores usan `border: 2px solid` para delimitar secciones, no padding ni colores de fondo
- **Asimetría intencional**: hero con texto gigante izquierda + elemento visual derecha sin margen entre ellos
- **Espaciado**: mínimo 32px entre secciones, máximo 80px — no tan generoso como editorial
- **Columnas de texto**: max 60 caracteres por línea (legibilidad en texto masivo)

---

## 6. Depth & Elevation

```css
/* El offset shadow ES la profundidad en brutalismo */
--shadow-offset-sm: 3px 3px 0;    /* elementos pequeños */
--shadow-offset-md: 6px 6px 0;    /* cards, modales */
--shadow-offset-lg: 8px 8px 0;    /* elementos hero */

/* Color del shadow: blanco sobre negro, amarillo para accent */
/* Nunca sombras difusas (box-shadow blur > 0 es raro) */
```

---

## 7. Do's and Don'ts

**✅ Hacer:**
- Headings en UPPERCASE masivos (56px+)
- Offset shadows en botones y cards (4–8px)
- Bordes `border: 2px solid` visibles como estructura
- Tipografía monospace para etiquetas y código
- Un solo color de acento (amarillo) — nunca dos
- Hover states con `transform: translate()` para simular presión

**❌ No hacer:**
- Gradientes (ninguno)
- Bordes redondeados (máximo 0–2px)
- Más de 1 color de acento
- Sombras difusas (box-shadow con blur)
- Itálica
- Imágenes de stock genéricas (mejor sin imagen que con una mala)
- Fondos claros (este sistema es dark-first)

---

## 8. Responsive Behavior

```
Desktop  (≥1024px): layout full-width, headings masivos, offset shadows completos
Tablet   (640–1023px): headings reducidos (max 40px), shadows más pequeños
Mobile   (<640px): 1 col, headings 28–32px, sin offset shadow (tap targets), padding lateral 16px
```

---

## 9. Agent Prompt Guide

> Usa el sistema Bold Brutalist: fondo casi negro (#0A0A0A), texto casi blanco (#F5F5F5), acento amarillo brillante (#F0E040) solo en 1–2 elementos. Space Grotesk para headings (700–900 weight, UPPERCASE), Space Mono para UI y labels. Bordes duros (border-radius: 0), offset shadows en botones y cards (4–8px sin blur). Sin gradientes. Sin bordes redondeados. Sin fuentes serif. El diseño se siente como un cartel de propaganda bien ejecutado: impactante, directo, sin decoración innecesaria.
