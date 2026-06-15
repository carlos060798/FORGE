# DESIGN SYSTEM: Neutral Modern

> **Dirección**: Minimal, funcional, sobrio. Confiable sin ser frío. El diseño no compite con el contenido.

---

## 1. Visual Theme & Atmosphere

Calm, functional, quietly confident. Espacios amplios. Tipografía clara. Acciones obvias.
El producto desaparece — solo queda la tarea del usuario.

**Palabras clave**: limpio · espacioso · legible · confiable · sin adornos

---

## 2. Color Palette & Roles

```css
/* Fondos */
--bg-base:       #FAFAFA;   /* fondo principal */
--bg-surface:    #FFFFFF;   /* tarjetas, modales */
--bg-subtle:     #F4F4F5;   /* inputs, secciones alternadas */
--bg-emphasis:   #E4E4E7;   /* hover states */

/* Texto */
--text-primary:  #111111;   /* texto principal */
--text-secondary:#52525B;   /* texto de soporte, labels */
--text-muted:    #A1A1AA;   /* placeholders, deshabilitados */
--text-inverse:  #FFFFFF;   /* texto sobre fondos oscuros */

/* Acento */
--accent:        #2563EB;   /* acciones primarias, links, focus */
--accent-hover:  #1D4ED8;   /* hover del acento */
--accent-subtle: #EFF6FF;   /* fondos de chips, badges de acento */

/* Estado */
--success:       #16A34A;
--warning:       #D97706;
--error:         #DC2626;
--info:          #0284C7;

/* Bordes */
--border:        #E4E4E7;   /* separadores, inputs */
--border-strong: #A1A1AA;   /* bordes con más énfasis */
```

**Regla de uso**: El acento aparece máximo en 2 elementos por pantalla. Nunca decorativo — solo en acciones.

---

## 3. Typography Rules

```css
/* Fuentes */
--font-display: 'Inter', system-ui, sans-serif;
--font-body:    'Inter', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', monospace;

/* Escala (8 pasos) */
--text-xs:   12px / 1.4;
--text-sm:   14px / 1.5;
--text-base: 16px / 1.6;   /* body default */
--text-lg:   18px / 1.5;
--text-xl:   20px / 1.4;
--text-2xl:  24px / 1.3;
--text-3xl:  30px / 1.2;
--text-4xl:  36px / 1.1;

/* Pesos */
--weight-normal:   400;
--weight-medium:   500;
--weight-semibold: 600;
--weight-bold:     700;

/* Tracking */
--tracking-tight:  -0.02em;   /* headings grandes */
--tracking-normal:  0em;
--tracking-wide:    0.05em;   /* labels, caps pequeñas */
```

**Reglas**:
- H1: 30–36px, weight 700, tracking -0.02em
- H2: 24px, weight 600
- Body: 16px, weight 400, line-height 1.6
- Labels: 12–14px, weight 500, UPPERCASE solo para etiquetas de categoría

---

## 4. Component Stylings

### Botones
```css
/* Primario */
.btn-primary {
  background: var(--accent);
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 14px;
}
.btn-primary:hover { background: var(--accent-hover); }

/* Secundario */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
  padding: 10px 20px;
  border-radius: 6px;
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 16px;
}
.btn-ghost:hover { background: var(--bg-subtle); }
```

### Cards
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
```

### Inputs
```css
.input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
}
.input:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent-subtle);
  outline-offset: 0;
}
```

### Badges / Tags
```css
.badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-subtle);
  color: var(--text-secondary);
}
```

---

## 5. Layout Principles

- **Grid**: 12 columnas, gutter 24px, max-width 1200px
- **Contenedor principal**: `max-width: 1200px; margin: 0 auto; padding: 0 24px`
- **Sidebar**: 240–280px fijo, contenido: el resto
- **Espaciado base**: múltiplos de 4px (4, 8, 12, 16, 24, 32, 48, 64, 96)
- **Sección vertical**: `padding-top: 64px; padding-bottom: 64px`

---

## 6. Depth & Elevation

Solo 2 niveles:
```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);  /* cards */
--shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04); /* modales, dropdowns */
```

Sin `box-shadow` de colores. Sin sombras de 4+ capas. La elevación se comunica con el color de fondo, no con sombras.

---

## 7. Do's and Don'ts

**✅ Hacer:**
- Espacios amplios entre secciones (mínimo 48px)
- Labels cortos y directos
- Un CTA primario por pantalla
- Alineación consistente (izquierda para texto, centro para CTAs standalone)
- Feedback visual claro (loading, success, error)

**❌ No hacer:**
- Gradientes en botones o fondos de hero
- Más de 2 colores de acento en la misma pantalla
- Bordes redondeados > 12px (excepto avatares/círculos)
- Texto en mayúsculas excepto labels de categoría ≤ 12px
- Iconos decorativos sin función
- Métricas inventadas ("10x más rápido")
- Lorem ipsum o copy de relleno

---

## 8. Responsive Behavior

```
Desktop  (≥1024px): 12 columnas, sidebar visible, navbar horizontal
Tablet   (640–1023px): 8 columnas, sidebar colapsable, navbar comprimido
Mobile   (<640px): 4 columnas (1 col layout), navegación bottom bar o hamburger
```

**Breakpoints**:
```css
@media (max-width: 1023px) { /* tablet */ }
@media (max-width: 639px)  { /* mobile */ }
```

---

## 9. Agent Prompt Guide

Cuando un agente genere UI con este sistema:

> Usa el sistema Neutral Modern: fondos claros (#FAFAFA, #FFFFFF), texto oscuro (#111111), acento azul (#2563EB) solo en acciones primarias. Inter para todo el texto. Bordes sutiles (#E4E4E7), sombras mínimas. Espaciado generoso (mínimo 24px entre secciones). Sin gradientes. Sin emojis como iconos. Un solo CTA primario por pantalla. Cuando en duda, quita elementos en lugar de agregar.
