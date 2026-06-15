---
description: Aplica un checklist de calidad formal a la spec activa — verifica completitud, claridad, testabilidad y alineación con la constitución. "Tests unitarios para los requisitos."
allowed-tools: Read, Write, Bash
handoffs:
  - etiqueta: "Aclarar lo que falla"
    comando: sdd.aclarar
  - etiqueta: "Pasar al plan"
    comando: sdd.planificar
---

# /sdd.checklist — Checklist de Calidad

Eres el **Auditor de Calidad de Requisitos**. Aplicas validación formal antes de permitir pasar al plan técnico. La calidad de la spec se compunde — un mal CA se convierte en una mala tarea y un mal test.

## PASO 1 — Cargar artefactos

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
SPEC_FILE=".sdd/especificaciones/${SPEC_ID}/spec.md"
cat "$SPEC_FILE"
cat .sdd/memoria/constitucion.md
```

## PASO 2 — Aplicar checklist completo

Evalúa cada ítem como **✅ PASA**, **❌ FALLA** o **⚠️ PARCIAL** con justificación.

### A. Calidad de Contenido

- [ ] **A1**: La spec NO contiene detalles de implementación (lenguajes, frameworks específicos, librerías concretas en CAs)
- [ ] **A2**: Enfoque en valor para el usuario, no en cómo se implementa
- [ ] **A3**: Legible por un stakeholder no-técnico
- [ ] **A4**: Todas las secciones obligatorias están completadas
- [ ] **A5**: Frontmatter YAML está bien formado

### B. Completitud de Requisitos

- [ ] **B1**: No quedan marcadores `[NECESITA_ACLARACION]` críticos
- [ ] **B2**: Cada requisito es testeable (sin palabras vagas: rápido, fácil, intuitivo, óptimo)
- [ ] **B3**: Cada requisito es no-ambiguo (una sola interpretación posible)
- [ ] **B4**: Cada CA usa Dado/Cuando/Entonces o equivalente formal
- [ ] **B5**: Todos los escenarios principales tienen su CA (feliz + error + borde)
- [ ] **B6**: El alcance está claramente delimitado (Sección "Fuera de Alcance" completa)
- [ ] **B7**: Las dependencias están identificadas
- [ ] **B8**: Las asunciones están explícitas
- [ ] **B9**: Los criterios de éxito medibles tienen métricas concretas
- [ ] **B10**: Todos los actores y sus permisos están definidos

### C. Calidad de Criterios de Aceptación

Por cada CA, verifica:
- [ ] **C1**: Tiene un ID único
- [ ] **C2**: Es atómico (verifica una sola cosa)
- [ ] **C3**: Es observable externamente (sin verificar implementación interna)
- [ ] **C4**: Tiene prioridad asignada (P1/P2/P3)
- [ ] **C5**: Puede convertirse directamente en un test

### D. Cobertura de Escenarios

- [ ] **D1**: Mínimo 1 escenario de caso feliz
- [ ] **D2**: Mínimo 1 escenario de error
- [ ] **D3**: Mínimo 1 escenario de caso borde
- [ ] **D4**: Escenarios de concurrencia si aplica
- [ ] **D5**: Comportamiento con datos extremos (vacíos, máximos, mínimos)
- [ ] **D6**: Manejo de fallos de dependencias externas si aplica

### E. Cumplimiento de Constitución

- [ ] **E1**: La spec respeta TODAS las restricciones arquitectónicas
- [ ] **E2**: Los estándares de calidad requeridos están reflejados
- [ ] **E3**: No introduce conflictos con principios fundamentales
- [ ] **E4**: La versión de constitución está registrada en el frontmatter

### F. Términos del Dominio

- [ ] **F1**: Términos nuevos están listados en sección 10
- [ ] **F2**: Los términos del glosario se usan consistentemente
- [ ] **F3**: No hay sinónimos confusos (mismo concepto, palabras distintas)

### G. Trazabilidad

- [ ] **G1**: Cada CA se vincula a al menos una historia de usuario
- [ ] **G2**: Cada requisito funcional se vincula a un objetivo
- [ ] **G3**: Hay enlace a issues/mockups/docs externos relevantes

### H. Métricas de Éxito

- [ ] **H1**: Los criterios de éxito son medibles (con número, no adjetivos)
- [ ] **H2**: Los criterios son alcanzables y realistas
- [ ] **H3**: Los criterios pueden verificarse después del lanzamiento

## PASO 3 — Generar reporte

Crea `.sdd/especificaciones/{ID}/checklist-spec.md`:

```markdown
# Checklist de Calidad: {ID}

> Fecha: {FECHA} | Spec versión: [vN]
> Resultado: {APROBADA | NECESITA_REVISION | RECHAZADA}

## Puntuación

- Total ítems: [X]
- Pasados (✅): [N]
- Fallidos (❌): [N]
- Parciales (⚠️): [N]
- **Cobertura: [%]**

## Resultados por categoría

### A. Calidad de Contenido — [N/N]
- [✅/❌/⚠️] A1: [resultado] — [justificación si no PASA]
- ...

### B. Completitud — [N/N]
- ...

[... continuar todas las categorías ...]

## Hallazgos críticos

[Lista de ítems FALLIDOS que bloquean el avance]

## Recomendaciones

[Lista accionable de qué hacer para corregir cada hallazgo]

## Veredicto

**[APROBADA | NECESITA_REVISION | RECHAZADA]**

[Justificación breve]
```

## PASO 4 — Determinar veredicto

**APROBADA**: Todos los críticos (B1, B2, B6, E1, E3) pasan. Otros pueden ser parciales.

**NECESITA_REVISION**: 1-3 críticos fallidos. Recuperable con `/sdd.aclarar` o edición manual.

**RECHAZADA**: 4+ críticos fallidos o problemas estructurales graves. La spec necesita re-escritura sustancial.

## PASO 5 — Acción según veredicto

**APROBADA:**
```
✅ Checklist: APROBADA
📊 Cobertura: [%]
📁 .sdd/especificaciones/{ID}/checklist-spec.md

SIGUIENTE PASO:
   /sdd.planificar    — generar plan técnico
```

**NECESITA_REVISION:**
```
⚠️  Checklist: NECESITA REVISIÓN
📊 Cobertura: [%]
🔴 [N] hallazgos críticos

ACCIÓN RECOMENDADA:
   /sdd.aclarar       — resolver los puntos críticos automáticamente
```

**RECHAZADA:**
```
❌ Checklist: RECHAZADA
🔴 [N] problemas estructurales

ACCIÓN REQUERIDA:
   Edita manualmente la spec o ejecuta /sdd.especificar de nuevo
   con una descripción más detallada.
```
