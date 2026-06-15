# Anti-AI-Slop Rules

> Reglas cardinales para evitar patrones visuales genéricos de IA. Adoptado de open-design (nexu-io).
> **P0 = bloqueante**: si el artefacto viola estas reglas, la crítica automática lo rechaza (score < 4).

---

## Las 7 Reglas Cardinales

### Regla 1 — Prohibido el índigo default de Tailwind

❌ **Nunca usar**: `#6366F1`, `#4F46E5`, `#7C3AED`, `#8B5CF6`, `#6D28D9`

Estos colores son la firma del "AI-generated UI" sin dirección. Si el DESIGN.md activo no especifica morado/índigo, no lo uses. Si lo especifica, usa el valor exacto del DESIGN.md.

✅ **En su lugar**: el color de acento definido en el DESIGN.md activo.

---

### Regla 2 — Prohibido el gradiente "trust" de 2 paradas

❌ **Nunca usar en heroes o CTAs**:
- `linear-gradient(135deg, #6366F1, #2563EB)` (purple → blue)
- `linear-gradient(135deg, #667EEA, #764BA2)` (lavender → purple)
- `linear-gradient(90deg, #00B4D8, #90E0EF)` (blue → cyan)
- Cualquier gradiente de 2 colores en una dirección diagonal sobre el hero

✅ **En su lugar**: fondo sólido del color base del DESIGN.md. Si el diseño requiere gradiente, que tenga intención editorial (ej: warm-editorial puede usar un gradiente de tonos tierra muy sutil).

---

### Regla 3 — Prohibidos los emojis como iconos de features

❌ **Nunca hacer esto**:
```html
<div class="feature">
  <span class="icon">⚡</span>
  <h3>Rápido y confiable</h3>
</div>
```

✅ **En su lugar**: SVG monoline simple, o ningún icono. Si no hay icono SVG disponible, usar texto puro o un elemento decorativo del DESIGN.md.

---

### Regla 4 — Respetar la fuente del DESIGN.md activo

❌ **Nunca mezclar**: si el DESIGN.md dice `font-display: 'Playfair Display'`, no usar sans-serif para headings.

✅ **Regla**: las fuentes del artefacto deben coincidir exactamente con las del DESIGN.md activo. No "mejorar" con fuentes propias.

Si el DESIGN.md no especifica una fuente (raro), usar `system-ui, sans-serif`.

---

### Regla 5 — Prohibido el patrón "AI dashboard tile"

❌ **Nunca hacer esto**:
```html
<div style="border-left: 4px solid #6366F1; border-radius: 8px; background: #F9FAFB;">
  <span>10x más rápido</span>
</div>
```

Este patrón — card redondeada con borde izquierdo de color + métrica — es el sello del UI genérico de IA.

✅ **En su lugar**: el estilo de card definido en el DESIGN.md activo. Las métricas deben ser reales o no aparecer.

---

### Regla 6 — Prohibidas las métricas inventadas

❌ **Nunca usar**:
- "10x más rápido"
- "99.9% de uptime"
- "2 millones de usuarios satisfechos"
- "50% de ahorro de tiempo garantizado"

...a menos que el usuario haya provisto esos números en el IR o el contexto.

✅ **En su lugar**: si se necesita una métrica de ejemplo, usar un placeholder explícito como `[X]% de mejora` o omitirla.

---

### Regla 7 — Prohibido el copy de relleno

❌ **Nunca usar**:
- Lorem ipsum o variantes
- "Feature One", "Feature Two", "Feature Three"
- "Descripción de la feature aquí"
- "Título del beneficio"
- "Texto placeholder"

✅ **En su lugar**: copy derivado del IR del proyecto. Si no hay copy real, usar `[Nombre de la feature]` con corchetes para marcar que es un placeholder explícito.

---

## Patrones Adicionales a Evitar (P1 — no bloqueante pero penaliza el score)

### P1-A: Hero con imagen de stock genérica
- Personas sonriendo frente a pantallas
- Oficinas modernas con plantas
- Manos sobre teclados

✅ En su lugar: sin imagen, color de fondo sólido del DESIGN.md, o SVG ilustrativo relacionado al producto.

### P1-B: Navbar con logo "Empresa" y menú genérico
```html
<!-- Evitar -->
<nav>
  <div class="logo">Empresa</div>
  <a href="#">Inicio</a>
  <a href="#">Características</a>
  <a href="#">Precios</a>
  <a href="#">Blog</a>
  <button>Empieza Gratis</button>
</nav>
```
✅ El nombre de la navbar debe venir del `product.name` del IR.

### P1-C: Footer con 4 columnas de links vacíos
El footer de "AI-slop" tiene 4 columnas (Producto, Empresa, Recursos, Legal) con links que no llevan a ningún lado.
✅ Si el MVP no tiene esas secciones, el footer es mínimo: copyright + link principal.

### P1-D: Sección "Como funciona" con 3 pasos numerados + iconos genéricos
El patrón de "1. Regístrate → 2. Configura → 3. Disfruta" con íconos de rocket/check/star es omnipresente.
✅ Si el producto tiene un flujo real, muéstralo. Si no, omite esta sección.

### P1-E: Testimonials inventados
```html
<!-- Evitar -->
<blockquote>
  "Este producto cambió mi vida."
  — María García, CEO de Empresa S.A.
</blockquote>
```
✅ Si no hay testimonials reales del IR, omitir la sección completamente.

---

## Cómo aplicar estas reglas

Los agentes **product-designer** y **wireframe-mvp** deben:

1. Antes de generar cualquier UI, leer este archivo
2. Generar el artefacto
3. Hacer auto-checklist: ¿viola alguna de las 7 reglas cardinales?
4. Si viola alguna P0: corregir antes de entregar
5. Si viola P1: mencionar en el output y decidir si corregir

La skill **critica-diseno** evalúa explícitamente "Ausencia de AI-slop" como una de sus 5 dimensiones.

---

## Origen

Estas reglas están adaptadas de `open-design` (nexu-io/open-design), proyecto Apache-2.0.
La lista de colores prohibidos y los patrones fueron identificados por análisis de outputs de modelos de lenguaje entre 2023–2025.
