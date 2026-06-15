---
description: Verifica consistencia y cobertura cruzada entre constitución, spec, plan y tareas. Detecta huecos, contradicciones y violaciones antes de implementar.
allowed-tools: Read, Write, Bash
handoffs:
  - etiqueta: "Corregir hallazgos"
    comando: sdd.planificar
    prompt: "revisar"
  - etiqueta: "Implementar"
    comando: sdd.implementar
---

# /sdd.analizar — Auditoría de Consistencia

Eres el **Auditor de Consistencia**. Cruzas los 4 artefactos (constitución, spec, plan, tareas) buscando incoherencias antes de que se conviertan en bugs o retrabajo.

## PASO 1 — Cargar TODOS los artefactos

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
SPEC_DIR=".sdd/especificaciones/${SPEC_ID}"

cat .sdd/memoria/constitucion.md
cat "${SPEC_DIR}/spec.md"
cat "${SPEC_DIR}/plan.md"
cat "${SPEC_DIR}/tareas.md"
cat "${SPEC_DIR}/.estado-tareas.json"
cat .sdd/dominio/glosario.md 2>/dev/null
ls .sdd/arquitectura/ 2>/dev/null
```

## PASO 1.5 — Model routing para dimensiones

Aplica el mismo routing de modelos que `/sdd.implementar` al despachar las dimensiones de análisis:

```
Grupo OPUS → análisis de constitución, seguridad y arquitectura (D1, D5, D7)
Grupo SONNET → análisis de spec, plan, tareas y glosario (D2, D3, D4, D6)
```

Cuando PTC está disponible, el routing se aplica a cada subagente en el bloque paralelo.

## PASO 1.6 — Despacho PTC de dimensiones

Las 7 dimensiones de auditoría son **independientes entre sí** — cada una lee los mismos artefactos sin modificarlos. Esto las hace candidatas ideales para PTC (skill `orquestacion-ptc`). El modelo de cada subagente sigue el routing del PASO 1.5.

**Si hay ≥3 agentes disponibles para ejecutar el análisis en paralelo:**

```javascript
// Bloque PTC — analiza dimensiones en paralelo
const dimensiones = [
  { id: "D1", titulo: "Constitución ↔ Plan",    artefactos: [constitucion, plan] },
  { id: "D2", titulo: "Spec ↔ Plan",            artefactos: [spec, plan] },
  { id: "D3", titulo: "Plan ↔ Tareas",          artefactos: [plan, tareas] },
  { id: "D4", titulo: "Spec ↔ Tareas (CAs)",    artefactos: [spec, tareas] },
  { id: "D5", titulo: "Tareas internas",        artefactos: [tareas] },
  { id: "D6", titulo: "Glosario",               artefactos: [spec, plan, tareas, glosario] },
  { id: "D7", titulo: "Config de agentes",      artefactos: [tareas, config] }
];

const resultados = await Promise.all(
  dimensiones.map(d => Task("critico", analizarDimension(d)))
);

// Agrega solo hallazgos — sin el razonamiento intermedio
return resultados.map((r, i) => ({
  dimension: dimensiones[i].id,
  bloqueantes:    r.hallazgos.filter(h => h.severidad === "bloqueante"),
  observaciones:  r.hallazgos.filter(h => h.severidad === "observacion"),
  ok:             r.hallazgos.length === 0
}));
```

**Fallback secuencial** — Si PTC no está disponible: analizar dimensión por dimensión con el PASO 2 estándar. El resultado es idéntico.

---

## PASO 2 — Análisis cruzado por dimensión

### Dimensión 1 — Constitución ↔ Plan
Verifica:
- [ ] El plan respeta CADA principio fundamental
- [ ] Las restricciones arquitectónicas no se violan
- [ ] Los estándares de calidad están reflejados en las decisiones
- [ ] Si hay desviaciones, están en sección "Complejidad Justificada" con razón válida

### Dimensión 2 — Spec ↔ Plan
- [ ] Cada Requisito Funcional (RF-*) tiene contraparte técnica en el plan
- [ ] Cada Requisito No Funcional (rendimiento, seguridad, etc.) está abordado
- [ ] Los actores definidos en la spec tienen capa de autorización en el plan
- [ ] Los escenarios de error de la spec están manejados en el plan
- [ ] Las exclusiones explícitas de la spec NO aparecen en el plan
- [ ] Los términos del dominio se usan consistentemente

### Dimensión 3 — Plan ↔ Tareas
- [ ] Cada archivo del plan (CREAR/MODIFICAR/ELIMINAR) tiene al menos una tarea
- [ ] Las decisiones técnicas del plan se aplican en las tareas correctas
- [ ] Las dependencias entre archivos se respetan en el orden de tareas
- [ ] La estrategia de tests del plan está cubierta por tareas concretas
- [ ] Las dependencias nuevas tienen una tarea de "agregar dependencia X"
- [ ] Cada riesgo tiene una tarea de mitigación o se acepta explícitamente

### Dimensión 4 — Spec ↔ Tareas (cobertura inversa)
- [ ] **Cada CA está cubierto por al menos una tarea** (la matriz de cobertura)
- [ ] **Cada Historia de Usuario tiene tareas que la implementan**
- [ ] No hay tareas "huérfanas" que no rastrean a ningún requisito
- [ ] Los criterios de éxito medibles tienen una tarea de instrumentación/observabilidad

### Dimensión 5 — Tareas internas
- [ ] El grafo de dependencias no tiene ciclos
- [ ] Cada tarea tiene un criterio de verificación concreto
- [ ] Cada tarea tiene un agente responsable asignado
- [ ] El agente asignado existe y está activo en config
- [ ] El orden de fases es lógico (tipos antes que usos, tests antes que código si TDD)

### Dimensión 6 — Glosario
- [ ] Términos del dominio usados en spec/plan/tareas existen en glosario
- [ ] No hay sinónimos (mismo concepto, palabras diferentes)
- [ ] Términos nuevos están registrados o pendientes de registrar

### Dimensión 7 — Configuración de agentes
- [ ] Todos los agentes referenciados en tareas están activos
- [ ] Los modelos asignados tienen sentido para la complejidad de la tarea
- [ ] No hay tareas críticas (seguridad, BD) asignadas a modelos pequeños

## PASO 3 — Generar reporte

Crea `.sdd/especificaciones/{ID}/analisis.md`:

```markdown
---
spec_id: {SPEC_ID}
fecha_analisis: {FECHA}
veredicto: APROBADO | OBSERVACIONES | BLOQUEADO
---

# Análisis de Consistencia: {SPEC_ID}

## Veredicto: **{VEREDICTO}**

[1-2 frases de resumen ejecutivo]

## Hallazgos

### 🔴 Bloqueantes (deben resolverse antes de implementar)

#### B1 — [Título]
- **Dimensión:** [cuál]
- **Descripción:** [qué inconsistencia se detectó]
- **Ubicación:** [archivo:sección]
- **Impacto si se ignora:** [qué pasaría]
- **Acción sugerida:** [qué hacer]

#### B2 — [...]

### 🟡 Observaciones (recomendable corregir)

#### O1 — [Título]
- [mismo formato pero impacto menor]

### 🟢 Buenas señales

- [Áreas donde se hizo bien]

## Matriz de Cobertura: CAs → Tareas

| CA | Descripción | Tareas que lo cubren | Estado |
|----|-------------|---------------------|--------|
| CA-001-01 | [texto] | T001, T005 | ✅ |
| CA-001-02 | [texto] | — | ❌ NO CUBIERTO |
| CA-002-01 | [texto] | T003 | ✅ |

## Matriz de Cobertura: Riesgos → Mitigaciones

| Riesgo (plan) | Prob × Imp | Mitigación (tarea) | Estado |
|---------------|-----------|---------------------|--------|
| R1 | A × A | T004 | ✅ |
| R2 | M × A | — | ⚠️ Sin mitigación |

## Cumplimiento de Constitución

| Principio | Cumple en plan | Cumple en tareas | Notas |
|-----------|---------------|------------------|-------|
| Principio I | ✅ | ✅ | — |
| Principio II | ⚠️ | ✅ | Ver decisión #3 del plan |

## Distribución de Carga de Agentes

| Agente | Tareas asignadas | % del total |
|--------|------------------|-------------|
| arquitecto | [N] | [%] |
| desarrollador-backend | [N] | [%] |
| ... | ... | ... |

## Recomendaciones

1. [Acción concreta priorizada]
2. [Acción concreta]
3. [Acción concreta]

## Sugerencia de comando siguiente

`/sdd.[comando recomendado]`
```

## PASO 4 — Determinar veredicto

**APROBADO**: 0 bloqueantes. Cualquier número de observaciones.

**OBSERVACIONES**: 0 bloqueantes pero hay observaciones importantes. Se puede implementar pero con conciencia.

**BLOQUEADO**: ≥1 bloqueante. NO se debe implementar hasta corregir.

## PASO 5 — Acción según veredicto

**APROBADO:**
```
✅ Análisis: APROBADO
📁 .sdd/especificaciones/{ID}/analisis.md

[N] observaciones menores documentadas (no bloquean).

SIGUIENTE PASO:
   /sdd.implementar           — ejecutar tareas
```

**OBSERVACIONES:**
```
🟡 Análisis: CON OBSERVACIONES
📁 .sdd/especificaciones/{ID}/analisis.md
⚠️  [N] observaciones (no bloquean)

Puedes implementar, pero revisa primero el reporte.
Si quieres corregir antes:
   /sdd.planificar revisar    — ajustar plan
   /sdd.tareas                — regenerar tareas
```

**BLOQUEADO:**
```
🔴 Análisis: BLOQUEADO
📁 .sdd/especificaciones/{ID}/analisis.md
❌ [N] bloqueantes — NO implementes todavía

ACCIONES REQUERIDAS:
[Lista priorizada de qué hacer]

Empieza con:
   /sdd.[comando del primer bloqueante]
```

## Output styles

Si el argumento contiene `pm`, `arq` o `dev`, adapta el reporte del PASO 3:

**Modo `pm`:** Solo veredicto, número de bloqueantes y recomendación de acción. Sin dimensiones técnicas ni matrices.

**Modo `arq`:** Enfatiza las dimensiones 1 (Constitución↔Plan) y 5 (Tareas internas). Incluye la matriz de cobertura CAs→Tareas y el grafo de dependencias.

**Modo `dev`:** El reporte completo del PASO 3 con todas las dimensiones, matrices y distribución de agentes (comportamiento actual).

---
**HOOK:** `.sdd/hooks/despues_analizar.sh`
