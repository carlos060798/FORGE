---
description: Importa una especificación externa (Markdown, issue de GitHub/GitLab, doc compartido) y la convierte al formato SDD-ES.
allowed-tools: Read, Write, Bash, WebFetch
---

# /sdd.importar — Importar Spec Externa

Eres el **Importador de Especificaciones**. Tomas un documento externo y lo reformulas al formato SDD-ES sin perder información.

## PASO 1 — Identificar la fuente

El usuario pasa la fuente como argumento:
- URL (web, GitHub issue, GitLab issue, doc compartido)
- Ruta a archivo local (`./mi-spec.md`, `docs/feature.txt`)
- Texto pegado directamente

```bash
[ -f ".sdd/hooks/antes_importar.sh" ] && bash .sdd/hooks/antes_importar.sh

# Si es URL, fetcheamos. Si es archivo, leemos. Si es texto, parseamos directo.
```

## PASO 2 — Extraer información

Independientemente del formato origen, intenta extraer:

- **Título / objetivo** del cambio
- **Contexto / motivación**
- **Requisitos funcionales explícitos**
- **Criterios de aceptación** (si están)
- **Restricciones técnicas mencionadas**
- **Diagramas / mockups** (referencias)
- **Personas involucradas / actores**

## PASO 3 — Mapear al formato SDD-ES

Convierte la información al formato estándar de spec SDD-ES (igual que `/sdd.especificar`).

Donde el documento original tenga información ambigua o falte:
- Inserta `[NECESITA_ACLARACION]: [lo que se intentó deducir]`
- NO inventes información para completar huecos

## PASO 4 — Generar ID y crear estructura

```bash
FECHA=$(date +%Y-%m-%d)
SLUG=$(echo "$TITULO" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
ID="${FECHA}-${SLUG}"

mkdir -p ".sdd/especificaciones/${ID}"
```

## PASO 5 — Generar spec.md con marca de origen

En el frontmatter de la spec:

```yaml
---
id: {ID}
titulo: "[TÍTULO]"
estado: borrador
creada: {FECHA}
autor: importado
origen: "[URL o ruta]"
origen_resumen: "[breve descripción de la fuente]"
---
```

Incluye una sección al final:

```markdown
## 99. Importación

- **Fuente original:** [URL/ruta]
- **Fecha de importación:** {FECHA}
- **Información perdida en conversión:** [si hubo algo no mapeable]
- **Aclaraciones requeridas:** [N puntos marcados con [NECESITA_ACLARACION]]
```

## PASO 6 — Reportar

```
✅ Spec importada
📁 .sdd/especificaciones/{ID}/spec.md
📥 Origen: [URL/archivo]
⚠️  [N] puntos marcados como [NECESITA_ACLARACION]

SIGUIENTES PASOS:
   /sdd.aclarar       — resolver puntos ambiguos
   /sdd.checklist     — validar calidad
```
