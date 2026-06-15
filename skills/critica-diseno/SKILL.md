---
description: Auto-crítica del wireframe generado. Evalúa en 5 dimensiones con score 1-5. Si score < 4 y iteraciones < 3, refina el artefacto y repite. Adaptado de critique-theater de open-design.
model: sonnet
allowed-tools: Read, Write
---

# Skill: Crítica de Diseño

## Propósito

Después de generar el wireframe, esta skill lo evalúa en **5 dimensiones** y da un **score 1–5**. Si el score es bajo, refina el wireframe automáticamente y lo re-evalúa. El ciclo se repite hasta score ≥ 4 o 3 iteraciones.

Inspirado en `critique-theater` de open-design (nexu-io).

---

## Lo que lees antes de empezar

```bash
# El wireframe generado
cat .sdd/diseño/wireframe-pantalla-principal.html

# El DESIGN.md activo (para verificar fidelidad)
cat "$(cat .sdd/estado.json | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(d.design_system_path || '{PLUGIN_DIR}/design-systems/neutral-modern/DESIGN.md');
")"

# Las reglas anti-slop
cat "{PLUGIN_DIR}/craft/anti-ai-slop.md"
```

---

## Las 5 Dimensiones de Evaluación

### Dimensión 1: Jerarquía Visual (1–5)
¿El ojo del usuario sabe a dónde ir primero?

| Score | Criterio |
|-------|----------|
| 5 | Jerarquía clara: un elemento domina, luego soporte, luego detalle |
| 4 | Jerarquía buena con algún elemento secundario algo fuerte |
| 3 | Dos elementos compiten por atención principal |
| 2 | Múltiples elementos con el mismo peso visual |
| 1 | Sin jerarquía — todo tiene el mismo peso |

### Dimensión 2: Fidelidad al DESIGN.md (1–5)
¿El wireframe usa los tokens del sistema activo?

| Score | Criterio |
|-------|----------|
| 5 | Todos los colores, fuentes y componentes corresponden exactamente al DESIGN.md |
| 4 | Pequeñas desviaciones (un color ligeramente diferente, borde-radius incorrecto) |
| 3 | Usa el sistema general pero con elementos fuera del DESIGN.md |
| 2 | Sistema visual mixto — algunos tokens del DESIGN.md, otros no |
| 1 | Ignora el DESIGN.md activo completamente |

### Dimensión 3: Funcionalidad del MVP (1–5)
¿La pantalla permite hacer la acción principal del MVP?

| Score | Criterio |
|-------|----------|
| 5 | El usuario puede realizar la acción principal en ≤3 clicks desde esta pantalla |
| 4 | La acción principal está presente, quizás con un paso de más |
| 3 | La acción existe pero no es el elemento más prominente |
| 2 | La acción existe pero está perdida entre otros elementos |
| 1 | La pantalla no permite realizar la acción principal |

### Dimensión 4: Ausencia de AI-Slop (1–5)
¿El wireframe evita los patrones genéricos de IA?

| Score | Criterio |
|-------|----------|
| 5 | Cero violaciones de las 7 reglas cardinales + cero patrones P1 |
| 4 | Sin violaciones P0, máximo 1 patrón P1 |
| 3 | Sin violaciones P0, 2–3 patrones P1 |
| 2 | 1 violación P0 |
| 1 | 2+ violaciones P0 |

### Dimensión 5: Innovación Contextual (1–5)
¿El diseño tiene algo específico de este producto, o es completamente genérico?

| Score | Criterio |
|-------|----------|
| 5 | El copy, los datos de ejemplo y los elementos reflejan exactamente el dominio del producto |
| 4 | Mayoría de elementos son específicos del dominio, alguno genérico |
| 3 | Mezcla: algunos elementos específicos, otros genéricos |
| 2 | Solo el nombre del producto es específico — el resto es genérico |
| 1 | El wireframe podría ser de cualquier producto |

---

## Flujo de Crítica

### Iteración 1

1. Lee el wireframe
2. Evalúa las 5 dimensiones
3. Calcula el score promedio: `(D1 + D2 + D3 + D4 + D5) / 5`
4. Muestra el resultado:

```
CRÍTICA DEL DISEÑO (iteración 1/3)
─────────────────────────────────
Jerarquía visual:      [score]/5  [comentario breve]
Fidelidad al sistema:  [score]/5  [comentario breve]
Funcionalidad MVP:     [score]/5  [comentario breve]
Ausencia de AI-slop:   [score]/5  [comentario breve]
Innovación contextual: [score]/5  [comentario breve]
─────────────────────────────────
SCORE TOTAL: [promedio]/5

[Si score ≥ 4]: ✅ El diseño está listo.
[Si score < 4]: 🔄 Refinando... (iteración 1 → 2)
```

### Si score < 4 y iteraciones < 3

Genera una versión mejorada del wireframe corrigiendo los problemas detectados:

```
Mejoras aplicadas:
  → [problema D1 → solución aplicada]
  → [problema D4 → corrección aplicada]
```

Luego re-evalúa. Repite el proceso.

### Si score ≥ 4 (en cualquier iteración)

```
✅ DISEÑO APROBADO (score [X]/5, iteración [N]/3)

El wireframe de [screen.name] está listo.
```

### Si iteración 3 y aún < 4

```
⚠️ Score final: [X]/5 (después de 3 iteraciones)

El diseño es funcional pero tiene áreas de mejora.
Puedes continuar o decirme qué cambiar manualmente.
```

Continúa de todos modos — no bloquea el pipeline.

---

## Output del wireframe refinado

Si se hicieron mejoras, el wireframe refinado **reemplaza** el anterior usando la tool `Write`:
- Ruta: `.sdd/diseño/wireframe-pantalla-principal.html` (sobreescribe el anterior)
- Contenido: HTML completo refinado

---

## Guardar resultado de la crítica

```bash
cat > .sdd/diseño/critica-wireframe.md << 'CRITICA'
# Crítica del Wireframe — [product.name]

**Fecha**: [timestamp]
**Iteraciones**: [N]
**Score final**: [X]/5

## Dimensiones

| Dimensión | Score | Comentario |
|-----------|-------|-----------|
| Jerarquía visual | [N]/5 | [texto] |
| Fidelidad DESIGN.md | [N]/5 | [texto] |
| Funcionalidad MVP | [N]/5 | [texto] |
| Ausencia AI-slop | [N]/5 | [texto] |
| Innovación contextual | [N]/5 | [texto] |

## Mejoras aplicadas

[lista de mejoras si hubo iteraciones]
CRITICA
```

---

## Notas

- **No hay evaluación de colores "bonitos"** — solo fidelidad al DESIGN.md
- **No hay evaluación de creatividad** — solo funcionalidad y ausencia de slop
- La dimensión "Innovación Contextual" evalúa especificidad del dominio, no creatividad artística
- El score mínimo para continuar sin comentario es 4/5
- Si el usuario quiere saltarse la crítica: `/sdd.diseñar --sin-critica` (disponible en el comando)
