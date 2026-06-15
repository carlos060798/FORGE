---
description: Genera un wireframe HTML de la pantalla P0 del MVP. Usa el DESIGN.md activo para colores, tipografía y estilo. Guarda el HTML en .sdd/diseño/ con la tool Write. Respeta {PLUGIN_DIR}/craft/anti-ai-slop.md.
model: sonnet
allowed-tools: Read, Write, Bash
---

# Skill: Wireframe MVP

## Propósito

Generar un **wireframe HTML funcional** de la pantalla más importante del MVP (P0). El wireframe es visual, usa los tokens del DESIGN.md activo, y el usuario puede verlo antes de que exista una línea de código real.

---

## Lo que lees antes de empezar

```bash
# Pantalla P0
cat .sdd/product-design.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const p0 = d.core_screens.find(s => s.priority === 'P0');
  console.log(JSON.stringify(p0, null, 2));
  console.log('DESIGN:', d.design_direction);
"

# DESIGN.md activo
DESIGN_PATH=$(cat .sdd/estado.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(d.design_system_path || '{PLUGIN_DIR}/design-systems/neutral-modern/DESIGN.md');
")
cat "$DESIGN_PATH"

# Reglas anti-slop
cat "{PLUGIN_DIR}/craft/anti-ai-slop.md" | head -80
```

---

## Lo que produces

Un HTML completo, en un solo archivo, guardado con la tool `Write` en `.sdd/diseño/wireframe-pantalla-principal.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[product.name] — [screen.name]</title>
  <style>
    /* Variables del DESIGN.md activo */
    :root {
      --bg-base: [valor del DESIGN.md];
      --text-primary: [valor del DESIGN.md];
      --accent: [valor del DESIGN.md];
      /* ... resto de variables */
    }
    /* Estilos de componentes del DESIGN.md */
    /* ... */
  </style>
</head>
<body>
  <!-- Wireframe de [screen.name] -->
  <!-- Usando los elementos definidos en screen.elements[] -->
</body>
</html>
```

---

## Reglas de generación

### 1. Fidelidad al DESIGN.md

- Los valores CSS **deben coincidir** con el DESIGN.md activo (colores, fuentes, border-radius, sombras)
- Para las fuentes: si el DESIGN.md usa Google Fonts, añadir el `<link>` correspondiente
- Para bold-brutalist: `border-radius: 0`, offset shadows, UPPERCASE en headings
- Para warm-editorial: Playfair Display para headings, bordes casi cuadrados
- Para neutral-modern: Inter, border-radius 6–8px, sombras mínimas

### 2. Contenido del wireframe

- Usar **copy real derivado del IR** — el nombre del producto, las features del mvp
- **No usar lorem ipsum** ni "Feature One" ni placeholders genéricos
- Los datos de ejemplo deben ser coherentes con el dominio (si es peluquería, usar "10:00 - Ana García", no "Item 1")

### 3. Estructura del HTML

- Un solo archivo (no imports externos excepto Google Fonts)
- CSS en `<style>` inline
- No usar frameworks externos (no Tailwind, no Bootstrap)
- JavaScript solo si la pantalla lo requiere (ej: toggle de tab, modal básico)
- El wireframe debe verse bien en 1280px de ancho (desktop first para web)

### 4. Elementos a incluir

Genera los elementos definidos en `screen.elements[]` del ProductDesign:
- `nav` → barra de navegación con el nombre del producto + links principales
- `hero` → sección principal con el value proposition
- `form` → formulario con los campos relevantes al dominio
- `table` → tabla con datos de ejemplo del dominio
- `card` → tarjeta(s) con información
- `list` → lista de items
- `button` → botón con el label del CTA real
- `modal` → modal (puede ser cerrado por defecto)

### 5. Guardar con Write

Usa la tool `Write` para guardar el HTML directamente:
- Ruta destino: `.sdd/diseño/wireframe-pantalla-principal.html`
- Crear el directorio `.sdd/diseño/` si no existe (con `Bash`: `mkdir -p .sdd/diseño`)
- Después de guardar, abrir en el navegador: `start .sdd/diseño/wireframe-pantalla-principal.html` (Windows) / `open ...` (Mac) / `xdg-open ...` (Linux)

---

## Checklist anti-AI-slop (OBLIGATORIO antes de finalizar)

Antes de guardar el HTML, verifica:

- [ ] ¿Los colores son exactamente los del DESIGN.md? (sin indigo default `#6366F1`)
- [ ] ¿No hay gradientes de 2 colores en diagonal sobre el hero?
- [ ] ¿Los iconos son SVG o texto — no emojis?
- [ ] ¿La fuente es la del DESIGN.md (no sistema default si el DESIGN.md especifica una)?
- [ ] ¿No hay métricas inventadas ("10x más rápido")?
- [ ] ¿El copy es específico del dominio (no "Feature One", "Lorem ipsum")?
- [ ] ¿No hay el patrón "card con borde izquierdo de color + métrica"?

Si alguno falla, corregir antes de guardar.

---

## Guardar el output

```bash
mkdir -p .sdd/diseño
```

Luego usar la tool `Write` con ruta `.sdd/diseño/wireframe-pantalla-principal.html` y el HTML completo como contenido.

```bash
# Abrir en navegador tras guardar
start .sdd/diseño/wireframe-pantalla-principal.html    # Windows
# open .sdd/diseño/wireframe-pantalla-principal.html   # macOS
# xdg-open .sdd/diseño/wireframe-pantalla-principal.html # Linux

echo "✅ Wireframe guardado en .sdd/diseño/wireframe-pantalla-principal.html"
```

---

## Notas

- El wireframe es un **boceto funcional**, no el diseño final
- El objetivo es que el usuario vea "su producto" antes de que exista código
- Después del wireframe, la skill `critica-diseno` evalúa y refina automáticamente
- El HTML generado puede usarse como base para el frontend real (los tokens CSS son reutilizables)
- El HTML se abre directamente en el navegador del sistema — no requiere servidor
