# DESIGN SYSTEM: Warm Editorial

> **Dirección**: Cálido, editorial, humano. Inspirado en revistas de calidad. Serif para display, sans-serif para cuerpo. Tonos tierra.

---

## 1. Visual Theme & Atmosphere

Como una revista bien editada. Contenido primero, estructura visible. Tipografía como elemento de diseño.
Cálido sin ser informal. Elegante sin ser frío.

**Palabras clave**: editorial · cálido · legible · humano · curado · artesanal

---

## 2. Color Palette & Roles

```css
/* Fondos */
--bg-base:       #FAF8F4;   /* pergamino cálido */
--bg-surface:    #FFFFFF;
--bg-subtle:     #F2EDE6;   /* secciones alternadas */
--bg-emphasis:   #E8DDD2;   /* hover */

/* Texto */
--text-primary:  #1A1410;   /* casi negro cálido */
--text-secondary:#6B5D52;   /* marrón medio */
--text-muted:    #A89585;   /* gris cálido */
--text-inverse:  #FAF8F4;

/* Acento */
--accent:        #C0392B;   /* rojo editorial */
--accent-hover:  #A93226;
--accent-subtle: #FDECEA;

/* Secundario */
--accent2:       #8B6914;   /* dorado oscuro para detalles */

/* Estado */
--success:       #27AE60;
--warning:       #E67E22;
--error:         #C0392B;
--info:          #2980B9;

/* Bordes */
--border:        #DDD0C4;
--border-strong: #B8A99A;
```

---

## 3. Typography Rules

```css
/* Fuentes — la clave del sistema */
--font-display: 'Playfair Display', 'Georgia', serif;  /* headings */
--font-body:    'Source Serif 4', 'Georgia', serif;    /* body (serif también) */
--font-ui:      'Inter', system-ui, sans-serif;        /* labels, nav, botones */
--font-mono:    'JetBrains Mono', monospace;

/* Escala */
--text-xs:   12px / 1.4;   /* labels UI */
--text-sm:   14px / 1.5;
--text-base: 17px / 1.7;   /* cuerpo más generoso */
--text-lg:   20px / 1.6;
--text-xl:   24px / 1.4;
--text-2xl:  30px / 1.3;
--text-3xl:  38px / 1.15;
--text-4xl:  48px / 1.05;

/* Pesos display */
--display-normal: 400;
--display-italic: 400 italic;  /* uso frecuente de itálica en editorial */
--display-bold:   700;
```

**Reglas específicas**:
- H1: Playfair Display, 38–48px, weight 700, tracking -0.01em
- H2: Playfair Display, 30px, weight 400 (elegante sin negrita)
- Subtítulo / pullquote: Playfair Display italic, 20–24px
- Body: Source Serif 4, 17px, line-height 1.7 (más espacio para lectura)
- UI (botones, nav, labels): Inter, 13–14px

---

## 4. Component Stylings

### Botones
```css
/* Primario — sin bordes redondeados, más recto */
.btn-primary {
  background: var(--accent);
  color: white;
  padding: 12px 28px;
  border-radius: 2px;   /* casi cuadrado, editorial */
  font-family: var(--font-ui);
  font-weight: 500;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Outline editorial */
.btn-outline {
  background: transparent;
  border: 1.5px solid var(--text-primary);
  color: var(--text-primary);
  padding: 12px 28px;
  border-radius: 2px;
  font-family: var(--font-ui);
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

### Cards
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 0;   /* cuadrado, editorial */
  padding: 28px 32px;
}

/* Card con acento en borde izquierdo — solo para featured */
.card-featured {
  border-left: 3px solid var(--accent);
  padding-left: 28px;
}
```

### Divisores
```css
.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 32px 0;
}

/* Ornamental — para secciones principales */
.divider-ornamental::before {
  content: '✦';
  display: block;
  text-align: center;
  color: var(--accent2);
  margin-bottom: 8px;
}
```

### Pullquotes
```css
.pullquote {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 22px;
  line-height: 1.4;
  color: var(--text-secondary);
  border-left: 3px solid var(--accent);
  padding-left: 20px;
  margin: 32px 0;
}
```

---

## 5. Layout Principles

- **Grid**: 12 columnas, gutter 24px, max-width 1100px (más angosto = más editorial)
- **Columnas de contenido**: max 65–70 caracteres por línea (aprox 680px a 17px)
- **Sidebar editorial**: a la derecha, 30% del ancho
- **Espaciado**: múltiplos de 8px, generoso (secciones con 80–96px entre ellas)
- **Drop cap**: primera letra grande en artículos principales

---

## 6. Depth & Elevation

```css
/* Casi sin sombras — la jerarquía viene de la tipografía y los bordes */
--shadow-sm: 0 1px 4px rgba(26,20,16,0.08);
--shadow-md: 0 4px 16px rgba(26,20,16,0.10);
```

Sin sombras de colores. Sin elevation artificial. El peso visual viene del tamaño y grosor tipográfico.

---

## 7. Do's and Don'ts

**✅ Hacer:**
- Mezclar tamaños tipográficos con contraste fuerte (48px headline + 17px body)
- Usar itálica del display font para énfasis y citas
- Espaciado generoso entre párrafos (margin-bottom: 24px en body)
- Líneas divisoras delgadas entre secciones
- Fechas, categorías y bylines en Inter 12px uppercase

**❌ No hacer:**
- Fondos de colores brillantes o saturados
- Bordes muy redondeados (max 4px en botones, 0 en cards)
- Gradientes (ninguno)
- Iconos tipo emoji o ilustraciones de dibujos animados
- Demasiados elementos en una pantalla (editorial es curado)
- Tablas sin estilo cuidadoso de bordes
- Imágenes sin ratio definido (usar aspect-ratio: 16/9 o 3/2)

---

## 8. Responsive Behavior

```
Desktop  (≥1024px): layout de revista 2–3 col, tipografía grande
Tablet   (640–1023px): 1–2 col, tipografía reducida un nivel
Mobile   (<640px): 1 col, heading 28px max, mayor padding lateral (20px)
```

---

## 9. Agent Prompt Guide

> Usa el sistema Warm Editorial: fondos pergamino (#FAF8F4), tipografía Playfair Display para headings (serif, con itálica), Source Serif 4 para cuerpo, Inter para UI. Acento rojo oscuro (#C0392B) solo en acciones. Tonos tierra (#6B5D52, #A89585). Bordes casi cuadrados (border-radius 2px en botones, 0 en cards). Sin gradientes. Sin bordes redondeados grandes. Espaciado generoso. El diseño se siente como una revista de calidad: curado, elegante, tipográficamente rico.
