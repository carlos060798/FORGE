# Typography Rules — FORGE Craft

Adoptado de open-design (nexu-io). Referencia para agentes de diseño.

---

## Principio fundamental

**La tipografía no es decoración — es jerarquía.**

El lector debe saber en 0.3 segundos dónde está el título, el cuerpo y la acción. Si hay duda, la tipografía falló.

---

## Escala tipográfica base

Usa una escala con ratio 1.25 (Major Third) o 1.333 (Perfect Fourth). No inventes tamaños arbitrarios.

### Perfect Fourth (ratio 1.333) — recomendada para productos web

| Rol | Tamaño | Uso |
|-----|--------|-----|
| `--text-xs` | 10px | Labels, captions, badges |
| `--text-sm` | 12px | Texto auxiliar, metadata |
| `--text-base` | 14px | Cuerpo de texto principal |
| `--text-md` | 16px | Párrafos largos, descripciones |
| `--text-lg` | 18px | Lead text, subtítulos |
| `--text-xl` | 24px | Títulos de sección (h3) |
| `--text-2xl` | 32px | Títulos de página (h2) |
| `--text-3xl` | 48px | Hero titles (h1) |
| `--text-4xl` | 64px | Display (hero grande, landing) |

---

## Familias tipográficas por dirección visual

### Neutral Modern
- **Display/Headings**: Inter (Google Fonts) — `font-weight: 700`
- **Body**: Inter — `font-weight: 400`
- **Code**: `'Cascadia Code', 'Fira Code', monospace`
- **Característica**: sin serifa, geométrica, alta legibilidad

### Warm Editorial
- **Display**: Playfair Display (Google Fonts) — `font-weight: 700, 900`
- **Subheadings**: Source Serif 4 — `font-weight: 600`
- **Body**: Source Serif 4 — `font-weight: 400`
- **Labels/UI**: Inter — `font-weight: 500`
- **Característica**: contraste serif/sans para jerarquía editorial

### Bold Brutalist
- **Display/Headings**: Space Grotesk (Google Fonts) — `font-weight: 900`, UPPERCASE
- **Body**: Space Grotesk — `font-weight: 400`
- **Code/Mono accent**: Space Mono — `font-weight: 700`
- **Característica**: condensado, chocante, todo en mayúsculas para headings

---

## Reglas de composición

### Line height
- Headings: `line-height: 1.1` — `1.2`
- Body text: `line-height: 1.6` — `1.7`
- Labels/captions: `line-height: 1.3`

### Letter spacing
- Headings grandes (> 32px): `letter-spacing: -0.03em` (óptico)
- Body: `letter-spacing: 0`
- UPPERCASE labels: `letter-spacing: 0.08em` — `0.12em`
- Botones: `letter-spacing: 0.02em`

### Font weight en jerarquía
- Solo usar 3 pesos máximo por pantalla: `400` (body) + `600` (subheadings) + `700/900` (titles)
- No usar `font-weight: 300` — en pantallas oscuras parece roto
- No usar `font-weight: 500` como heading — es demasiado sutil para crear jerarquía

### Medida de línea (measure)
- Cuerpo de texto: **60–75 caracteres por línea** (óptimo de lectura)
- En CSS: `max-width: 65ch` para párrafos de texto largo
- Títulos: sin restricción de measure — llenan el contenedor

---

## Anti-patrones tipográficos (no hacer)

❌ **Mezclar más de 2 familias tipográficas** en la misma pantalla
❌ **Usar todas las variantes de peso** (100, 200, 300... 900) en una sola UI
❌ **Texto body menor a 13px** — ilegible en mobile y pantallas de alta densidad
❌ **Itálica en cuerpo largo** — reduce velocidad de lectura un 15%
❌ **Centrar texto de más de 3 líneas** — el ojo pierde el inicio de cada línea
❌ **Texto en mayúsculas para párrafos** — solo para labels cortos (< 4 palabras)
❌ **Combinar dos fuentes de la misma categoría** (dos sans-serif diferentes sin contraste suficiente)

---

## Cómo cargar fuentes (Google Fonts)

```html
<!-- Neutral Modern: Inter -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">

<!-- Warm Editorial: Playfair Display + Source Serif 4 -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">

<!-- Bold Brutalist: Space Grotesk + Space Mono -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

**Siempre incluir `display=swap`** para evitar FOIT (flash of invisible text).

---

## Referencia rápida para agentes

Cuando generes un wireframe:
1. Lee el DESIGN.md activo para saber qué familia tipográfica usar
2. Usa `<link>` de Google Fonts con `display=swap`
3. Define variables CSS: `--font-display`, `--font-body`, `--font-mono`
4. Aplica la escala: heading principal → `--text-3xl` o `--text-2xl`, body → `--text-base`
5. Letter-spacing negativo en headings grandes, positivo en UPPERCASE labels
6. Nunca mezclar más de 2 familias en la misma pantalla
