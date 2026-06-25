---
name: decompose-to-ui-kit
description: Descompone una imagen o descripción de UI en componentes reutilizables del design system y genera el kit de componentes base para el proyecto.
version: 1.0.0
agents: [product-designer, desarrollador-frontend]
inputs: [imagen_ui, descripcion_pantalla, DESIGN.md]
outputs: [components-kit.md, tokens.css]
---

# Skill: decompose-to-ui-kit

Convierte una referencia visual (imagen, screenshot, descripción) en un inventario de componentes reutilizables alineados con el `DESIGN.md` del proyecto.

## Cuándo usar

- Al iniciar el desarrollo frontend de un proyecto con diseño definido
- Cuando el usuario proporciona una imagen o referencia visual de UI
- Para auditar si los componentes existentes cubren las pantallas del spec

## Pipeline

```
Input (imagen / descripción)
        ↓
  [product-designer] — Análisis visual
        ↓
  Inventario de componentes identificados
        ↓
  [desarrollador-frontend] — Verificación de implementabilidad
        ↓
  components-kit.md + tokens.css
        ↓
  [EvaluatorOptimizer] — Verificación RV-01 a RV-12
```

## Paso 1 — Análisis visual (product-designer)

El agente `product-designer` analiza la referencia visual e identifica:

### 1.1 Átomos (elementos base)
Componentes que no se pueden descomponer más:
- Botones (variantes: primary, secondary, ghost, danger)
- Inputs (text, password, search, select, textarea)
- Badges y chips
- Iconos usados (nombre del set, tamaño, peso)
- Avatares y thumbnails
- Separadores y dividers

### 1.2 Moléculas (combinaciones simples)
- Form fields (label + input + error message)
- Search bar (input + botón + icono)
- Card de contenido (imagen + título + descripción + acción)
- Navigation item (icono + label + badge)
- Toast / notification (icono + mensaje + acción)

### 1.3 Organismos (secciones completas)
- Header / navbar
- Sidebar de navegación
- Tabla de datos con paginación
- Formulario multi-campo
- Lista de items con acciones

### 1.4 Plantillas (layouts)
- Layout de autenticación (centrado)
- Layout de dashboard (sidebar + contenido)
- Layout de detalle (header + contenido + sidebar)
- Layout de landing (full-width con secciones)

## Paso 2 — Verificación de implementabilidad (desarrollador-frontend)

El agente `desarrollador-frontend` revisa el inventario y marca cada componente:
- ✅ **Implementable** — tiene todos los tokens necesarios en DESIGN.md
- ⚠️ **Parcial** — falta algún token (especificar cuál)
- ❌ **Bloqueado** — requiere librería o asset externo no definido

## Paso 3 — Generación de artefactos

### components-kit.md
Documento con la especificación de cada componente:

```markdown
## Botón Primario

**Variantes:** default, hover, focus, disabled, loading

| Propiedad | Valor |
|---|---|
| background | `--color-primary` |
| color | `white` |
| padding | `--space-3` `--space-4` |
| border-radius | `--radius-md` |
| font-size | `--text-sm` |
| font-weight | `600` |

**Estados:**
- hover: `--color-primary-hover` + `--shadow-sm`
- focus: ring 2px `--color-primary` offset 2px
- disabled: opacity 40%, cursor not-allowed
- loading: spinner inline izquierda, texto "Cargando..."
```

### tokens.css
Variables CSS generadas desde DESIGN.md:

```css
:root {
  /* Colores */
  --color-primary: #000000;
  --color-primary-hover: #000000;
  /* ... todos los tokens de DESIGN.md ... */

  /* Tipografía */
  --text-xs: 11px;
  /* ... */

  /* Espaciado */
  --space-1: 4px;
  /* ... */

  /* Bordes */
  --radius-sm: 4px;
  /* ... */
}
```

## Verificación de paridad visual

Al finalizar el kit, el `EvaluatorOptimizer` ejecuta la rubric de 12 checks (`RUBRIC_VISUAL` de `core/evaluator-optimizer.ts`) sobre una muestra de los componentes generados. Score mínimo para aprobación: **8.0/10**.

## Activación

```
/decompose-to-ui-kit imagen=<ruta_o_descripcion>
```

O dentro del pipeline SDD, tras `/sdd.diseñar`:

```
/sdd.diseñar → DESIGN.md generado → /decompose-to-ui-kit → components-kit.md + tokens.css
```

## Salidas esperadas

| Archivo | Ubicación | Descripción |
|---|---|---|
| `components-kit.md` | `.sdd/design/components-kit.md` | Especificación de todos los componentes |
| `tokens.css` | `.sdd/design/tokens.css` | Variables CSS listas para usar |
| `DESIGN.md` | raíz del proyecto | Actualizado con componentes identificados |
