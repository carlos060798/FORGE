# DESIGN.md — Sistema de Diseño del Proyecto

> Generado por el agente `product-designer` de FORGE.  
> Este archivo es la fuente de verdad visual del proyecto. El agente `desarrollador-frontend` y el `EvaluatorOptimizer` (checks RV-01, RV-12) lo consultan para evaluar paridad visual.

---

## 1. Identidad visual

- **Nombre del producto:** <!-- ej: TaskFlow -->
- **Estilo general:** <!-- ej: minimal, bold-brutalist, enterprise, playful -->
- **Inspiración:** <!-- ej: Linear, Notion, Stripe -->

---

## 2. Paleta de colores

| Token | Valor HEX | Uso |
|---|---|---|
| `--color-primary` | `#000000` | Botones principales, enlaces, CTA |
| `--color-primary-hover` | `#000000` | Estado hover de primary |
| `--color-secondary` | `#000000` | Acciones secundarias |
| `--color-bg` | `#FFFFFF` | Fondo principal |
| `--color-bg-subtle` | `#F5F5F5` | Fondos de cards, sidebars |
| `--color-text` | `#111111` | Texto principal |
| `--color-text-muted` | `#666666` | Texto secundario, placeholders |
| `--color-border` | `#E0E0E0` | Bordes de inputs, cards |
| `--color-error` | `#DC2626` | Errores, validaciones |
| `--color-success` | `#16A34A` | Confirmaciones, éxito |
| `--color-warning` | `#D97706` | Advertencias |

---

## 3. Tipografía

- **Familia principal:** <!-- ej: Inter, Geist, DM Sans -->
- **Familia código:** <!-- ej: JetBrains Mono, Fira Code -->

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--text-xs` | 11px | 400 | Etiquetas, badges |
| `--text-sm` | 13px | 400 | Texto UI, inputs |
| `--text-base` | 15px | 400 | Body principal |
| `--text-lg` | 17px | 500 | Subtítulos |
| `--text-xl` | 20px | 600 | Títulos de sección |
| `--text-2xl` | 24px | 700 | Títulos de página |
| `--text-3xl` | 30px | 700 | Hero, landing |

---

## 4. Espaciado (escala base 4px)

| Token | Valor | Uso típico |
|---|---|---|
| `--space-1` | 4px | Gap mínimo entre elementos inline |
| `--space-2` | 8px | Padding de badges, gap de iconos |
| `--space-3` | 12px | Padding de inputs pequeños |
| `--space-4` | 16px | Padding de cards, gap de listas |
| `--space-6` | 24px | Padding de secciones |
| `--space-8` | 32px | Separación entre bloques |
| `--space-12` | 48px | Separación entre secciones grandes |
| `--space-16` | 64px | Márgenes de página |

---

## 5. Bordes y sombras

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 4px | Inputs, badges |
| `--radius-md` | 8px | Cards, botones |
| `--radius-lg` | 12px | Modales, panels |
| `--radius-full` | 9999px | Pills, avatares |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.1)` | Cards en reposo |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` | Cards elevadas, dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.15)` | Modales |

---

## 6. Componentes clave

### Botón primario
- Background: `--color-primary`
- Color texto: blanco
- Padding: `--space-3` vertical · `--space-4` horizontal
- Border-radius: `--radius-md`
- Hover: `--color-primary-hover` + sombra sutil
- Disabled: opacidad 40%

### Input de texto
- Border: 1px `--color-border`
- Border-radius: `--radius-sm`
- Padding: `--space-3`
- Focus: border `--color-primary` + ring 2px
- Error: border `--color-error`

### Card
- Background: `--color-bg`
- Border: 1px `--color-border`
- Border-radius: `--radius-md`
- Padding: `--space-6`
- Shadow: `--shadow-sm`

---

## 7. Pantallas principales

<!-- Listar las pantallas con descripción de layout y componentes clave -->

| Pantalla | Layout | Componentes principales |
|---|---|---|
| Login | Centrado vertical, max-width 400px | Card, Input×2, Botón primario, Link |
| Dashboard | Sidebar 240px + contenido | Nav, Cards de métricas, Tabla |
| Detalle | Header + contenido scrollable | Breadcrumb, Formulario, Botones de acción |

---

## 8. Checklist de paridad visual (RV-01 a RV-12)

Completar antes de entregar cada pantalla:

- [ ] RV-01: Paleta coincide con tokens de este documento
- [ ] RV-02: Tipografía usa familia y escala correctas
- [ ] RV-03: Espaciados siguen escala de 4px
- [ ] RV-04: Estados interactivos (hover/focus/disabled) implementados
- [ ] RV-05: Contraste WCAG AA verificado
- [ ] RV-06: Iconos consistentes en estilo y tamaño
- [ ] RV-07: Layout con grid/flex sin posicionamiento absoluto arbitrario
- [ ] RV-08: Bordes/sombras/radios según tokens
- [ ] RV-09: Responsivo en 375px y 1280px
- [ ] RV-10: Animaciones ≤300ms ease
- [ ] RV-11: Flujo principal completo sin pantallas rotas
- [ ] RV-12: Coherente con este DESIGN.md
