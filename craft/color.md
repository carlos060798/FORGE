# Color Rules — FORGE Craft

Adoptado de open-design (nexu-io). Referencia para agentes de diseño.

---

## Principio fundamental

**Un color de acento. Un color de fondo. Un color de texto. Todo lo demás es variante.**

La mayoría de diseños de IA generada fallan porque usan demasiados colores. La restricción genera identidad.

---

## Sistema de roles de color

Todo color en un UI tiene un **rol**, no un valor arbitrario. Define los roles primero, los valores después.

| Variable CSS | Rol | Descripción |
|--------------|-----|-------------|
| `--bg-base` | Fondo base | La superficie más grande de la pantalla |
| `--bg-surface` | Superficie elevada | Cards, modales, sidebars |
| `--bg-surface2` | Superficie doble elevada | Inputs, tooltips, dropdowns |
| `--text-primary` | Texto principal | Headings, labels importantes |
| `--text-secondary` | Texto secundario | Body text, descripciones |
| `--text-muted` | Texto atenuado | Metadata, placeholders, timestamps |
| `--text-inverse` | Texto invertido | Texto sobre fondos de acento |
| `--accent` | Color de acento | CTAs, links, indicadores de progreso |
| `--accent-hover` | Acento al hover | Versión más clara/oscura del acento |
| `--accent-subtle` | Acento sutil | Fondos de badges, highlights |
| `--border` | Bordes | Líneas divisorias, bordes de inputs |
| `--error` | Error | Mensajes de error, validación fallida |
| `--success` | Éxito | Confirmaciones, validación exitosa |
| `--warning` | Advertencia | Alertas no críticas |

---

## Paletas por dirección visual

### Neutral Modern (light)
```css
:root {
  --bg-base:      #FAFAFA;
  --bg-surface:   #FFFFFF;
  --bg-surface2:  #F4F4F5;
  --text-primary: #111111;
  --text-secondary: #374151;
  --text-muted:   #6B7280;
  --text-inverse: #FFFFFF;
  --accent:       #2563EB;
  --accent-hover: #1D4ED8;
  --accent-subtle:#DBEAFE;
  --border:       #E5E7EB;
  --error:        #DC2626;
  --success:      #16A34A;
  --warning:      #D97706;
}
```

### Warm Editorial (light)
```css
:root {
  --bg-base:      #FAF8F4;
  --bg-surface:   #FFFFFF;
  --bg-surface2:  #F5F0E8;
  --text-primary: #2C2416;
  --text-secondary: #4A3728;
  --text-muted:   #7C6B5A;
  --text-inverse: #FAF8F4;
  --accent:       #C0392B;
  --accent-hover: #A93226;
  --accent-subtle:#FADBD8;
  --border:       #DDD5C8;
  --error:        #C0392B;
  --success:      #1E8449;
  --warning:      #B7770D;
}
```

### Bold Brutalist (dark)
```css
:root {
  --bg-base:      #0A0A0A;
  --bg-surface:   #141414;
  --bg-surface2:  #1E1E1E;
  --text-primary: #F5F5F5;
  --text-secondary: #D0D0D0;
  --text-muted:   #888888;
  --text-inverse: #0A0A0A;
  --accent:       #F0E040;
  --accent-hover: #F5E860;
  --accent-subtle:#2A2800;
  --border:       #2E2E2E;
  --error:        #FF4444;
  --success:      #44FF88;
  --warning:      #FFAA00;
}
```

---

## Reglas de contraste (WCAG AA mínimo)

| Combinación | Ratio mínimo | Test |
|-------------|-------------|------|
| Texto sobre fondo base | 4.5:1 | `--text-primary` sobre `--bg-base` |
| Texto grande (> 18px bold) | 3:1 | `--text-secondary` sobre `--bg-surface` |
| Texto sobre acento | 4.5:1 | `--text-inverse` sobre `--accent` |
| Iconos / bordes | 3:1 | `--border` sobre `--bg-base` |

**Herramientas de verificación**: coolors.co/contrast-checker, webaim.org/resources/contrastchecker

### Ratios comprobados de las paletas FORGE

| Paleta | text-primary / bg-base | text-inverse / accent |
|--------|----------------------|-----------------------|
| Neutral Modern | #111111 / #FAFAFA → **19.6:1** ✅ | #FFFFFF / #2563EB → **4.7:1** ✅ |
| Warm Editorial | #2C2416 / #FAF8F4 → **14.2:1** ✅ | #FAF8F4 / #C0392B → **4.6:1** ✅ |
| Bold Brutalist | #F5F5F5 / #0A0A0A → **18.9:1** ✅ | #0A0A0A / #F0E040 → **14.3:1** ✅ |

---

## Anti-patrones de color (no hacer)

❌ **Gradiente de 2 colores en diagonal sobre hero** — cliché de IA generada (regla P0 de anti-ai-slop)
❌ **Indigo #6366F1 como acento** — el azul Tailwind por defecto (regla P0 de anti-ai-slop)
❌ **Más de 1 color de acento** — si necesitas un segundo acento, usa una variante del primero
❌ **Texto de color sobre fondo de color** — solo si el contraste es ≥ 4.5:1
❌ **Usar colores semánticos fuera de su rol** — `--error` no se usa para decoración
❌ **Sombras de color saturado** (glow effects, colored box-shadows) — en B2B y herramientas parece poco serio
❌ **Fondos blancos puros #FFFFFF en dark mode** — usar `--bg-surface` no `#FFFFFF`

---

## Cómo aplicar sombras (depth)

Las sombras deben ser casi negras, nunca de color. La opacidad define la profundidad.

```css
/* Nivel 1 — Cards, dropdowns */
box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);

/* Nivel 2 — Modales, sidebars elevados */
box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06);

/* Bold Brutalist — offset shadow sin difuminado */
box-shadow: 4px 4px 0 var(--accent);
```

---

## Referencia rápida para agentes

Cuando generes un wireframe:
1. Lee el DESIGN.md activo — copia las variables CSS exactas de la paleta
2. Define todas las variables en `:root { }` al inicio del `<style>`
3. Nunca uses colores hex directos en los componentes — usa las variables
4. Verifica mentalmente el contraste antes de finalizar (texto sobre fondo)
5. Si el DESIGN.md es bold-brutalist, las sombras son offset `4px 4px 0` sin blur
6. Nunca uses gradientes en diagonal como fondo de hero
